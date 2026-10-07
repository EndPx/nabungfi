import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import {
  CylinderGeometry, TorusGeometry, MeshPhysicalMaterial, MeshStandardMaterial,
  Matrix4, Vector3, Quaternion, Euler, PCFShadowMap, PMREMGenerator,
  type BufferGeometry, type Group, type InstancedMesh, type OrthographicCamera,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { LANDING_MODELS, SCULPTURE_COLORS, type LandingModelId, type SculpturePiece, type Vec3 } from "./landing-models";

const CYCLE = { build: 4, hold: 2.4, reverse: 2.8, empty: 0.5 };
const CYCLE_SECONDS = CYCLE.build + CYCLE.hold + CYCLE.reverse + CYCLE.empty;
const STUDIO_POSE = -0.35;
// Meet the finished build at its best three-quarter view, rather than edge-on.
const BUILD_START_ANGLE = STUDIO_POSE - (CYCLE.build / CYCLE_SECONDS) * Math.PI * 2;
const STUDIO_CAMERA = { position: [7,5,9] as Vec3, zoom:70, near:0.1, far:50 };
type Phase = "building" | "complete" | "reversing" | "empty";
type Batch = { id:string; geometry:BufferGeometry; material:MeshStandardMaterial; instances:{piece:number; offset:Matrix4}[] };

function batchesFor(pieces:readonly SculpturePiece[]) {
  const geometries = new Map<string,BufferGeometry>();
  const materials = new Map<string,MeshStandardMaterial>();
  const batches = new Map<string,Batch>();
  const add = (piece:number,kind:string,size:Vec3,offset:Vec3) => {
    const color=pieces[piece].color;
    const geometryKey=`${kind}:${size.join(":")}`;
    let geometry=geometries.get(geometryKey);
    if(!geometry){
      geometry=kind==="brick" ? new RoundedBoxGeometry(...size,2,Math.min(...size)*0.08)
        : kind==="tire" ? new TorusGeometry(0.78,0.22,10,32)
        : new CylinderGeometry(size[0],size[0],size[1],24);
      if(kind==="tire") geometry.scale(size[0],size[1],size[2]/0.44);
      geometries.set(geometryKey,geometry);
    }
    let material=materials.get(color);
    if(!material){
      material=new MeshPhysicalMaterial({color:SCULPTURE_COLORS[color],roughness:color==="rubber" ? 0.82 : color==="lens" ? 0.12 : 0.3,
        metalness:color==="graphite" ? 0.06 : 0,clearcoat:color==="rubber" ? 0 : 0.42,clearcoatRoughness:0.23});
      materials.set(color,material);
    }
    const key=`${geometryKey}:${color}`;
    let batch=batches.get(key);
    if(!batch){batch={id:key,geometry,material,instances:[]};batches.set(key,batch);}
    batch.instances.push({piece,offset:new Matrix4().makeTranslation(...offset)});
  };
  pieces.forEach((piece,i)=>{
    add(i,piece.kind,piece.size,[0,0,0]);
    if(!piece.studs)return;
    const nx=Math.max(1,Math.round(piece.size[0]/0.4)),nz=Math.max(1,Math.round(piece.size[2]/0.4));
    for(let x=0;x<nx;x++)for(let z=0;z<nz;z++){
      add(i,"stud",[0.078,0.052,0.078],[(x-(nx-1)/2)*0.4,piece.size[1]/2+0.024,(z-(nz-1)/2)*0.38]);
    }
  });
  return { batches:[...batches.values()], dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());} };
}

function StudioLight({tall}:{tall:boolean}) {
  const {gl,scene,camera,size,invalidate}=useThree();
  useLayoutEffect(()=>{
    const orthographic=camera as OrthographicCamera;
    orthographic.zoom=Math.min(size.width/6.2,size.height/(tall ? 5.3 : 4.2));
    camera.lookAt(0,tall ? 1.92 : 1.22,0);
    camera.updateProjectionMatrix();
    invalidate();
  },[camera,size.width,size.height,tall,invalidate]);
  useEffect(()=>{
    const old=scene.environment,oldIntensity=scene.environmentIntensity;
    const room=new RoomEnvironment(),generator=new PMREMGenerator(gl),texture=generator.fromScene(room,0.04);
    scene.environment=texture.texture;scene.environmentIntensity=0.45;invalidate();
    return()=>{scene.environment=old;scene.environmentIntensity=oldIntensity;texture.dispose();room.dispose();generator.dispose();};
  },[gl,scene,invalidate]);
  return <>
    <ambientLight intensity={0.75} />
    <hemisphereLight args={["#fffefa","#efeee6",0.85]} />
    <directionalLight position={[3,8,6]} intensity={2.7} castShadow shadow-mapSize={[1024,1024]}
      shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-normalBias={0.035} shadow-bias={-0.0003} />
    <directionalLight position={[-5,3,-4]} intensity={1.15} color="#fff0cc" />
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.04,0]} receiveShadow>
      <circleGeometry args={[3.05,64]} /><meshStandardMaterial color="#efeee6" roughness={0.95} />
    </mesh>
  </>;
}

function Sculpture({pieces,active,reducedMotion,stage,progress,onPhase,onNext,onReady}:{
  pieces:readonly SculpturePiece[];active:boolean;reducedMotion:boolean;
  stage:RefObject<HTMLDivElement|null>;progress:RefObject<HTMLDivElement|null>;
  onPhase:(phase:Phase)=>void;onNext:()=>void;onReady:()=>void;
}){
  const resources=useMemo(()=>batchesFor(pieces),[pieces]);
  const meshes=useRef<(InstancedMesh|null)[]>([]),root=useRef<Group>(null);
  const clock=useRef({build:reducedMotion ? 1 : 0,angle:reducedMotion ? STUDIO_POSE : BUILD_START_ANGLE});
  const timeline=useRef<gsap.core.Timeline|null>(null);
  const callbacks=useRef({onPhase,onNext,onReady});
  useLayoutEffect(()=>{callbacks.current={onPhase,onNext,onReady};},[onPhase,onNext,onReady]);
  const {invalidate}=useThree();
  const scratch=useMemo(()=>({position:new Vector3(),scale:new Vector3(),quaternion:new Quaternion(),euler:new Euler(),matrix:new Matrix4(),
    pieces:pieces.map(()=>new Matrix4()),zero:new Matrix4().makeScale(0,0,0)}),[pieces]);
  const ready=useRef(false);
  const publish=useCallback(()=>{
    if(stage.current)stage.current.dataset.build=String(Math.round(clock.current.build*100));
    if(progress.current)progress.current.style.transform=`scaleX(${clock.current.build})`;
    invalidate();
  },[stage,progress,invalidate]);
  useLayoutEffect(()=>{
    clock.current={build:reducedMotion ? 1 : 0,angle:reducedMotion ? STUDIO_POSE : BUILD_START_ANGLE};
    publish();
    if(reducedMotion){callbacks.current.onPhase("complete");return;}
    callbacks.current.onPhase("building");
    const tl=gsap.timeline({paused:true,onUpdate:publish,onComplete:()=>callbacks.current.onNext(),defaults:{ease:"none"}});
    tl.to(clock.current,{build:1,duration:CYCLE.build},0)
      .call(()=>callbacks.current.onPhase("complete"),[],CYCLE.build)
      .call(()=>callbacks.current.onPhase("reversing"),[],CYCLE.build+CYCLE.hold)
      .to(clock.current,{build:0,duration:CYCLE.reverse},CYCLE.build+CYCLE.hold)
      .call(()=>callbacks.current.onPhase("empty"),[],CYCLE.build+CYCLE.hold+CYCLE.reverse)
      .to(clock.current,{angle:BUILD_START_ANGLE+Math.PI*2,duration:CYCLE_SECONDS},0);
    timeline.current=tl;
    return()=>{tl.kill();timeline.current=null;};
  },[pieces,reducedMotion,invalidate,publish]);
  useLayoutEffect(()=>{
    if(active && !reducedMotion)timeline.current?.play();else timeline.current?.pause();
    invalidate();
  },[active,reducedMotion,pieces,invalidate]);
  useEffect(()=>{
    const instances=meshes.current.filter((mesh):mesh is InstancedMesh=>mesh!==null);
    return()=>{instances.forEach(mesh=>mesh.dispose());resources.dispose();};
  },[resources]);
  useFrame(()=>{
    if(!ready.current){ready.current=true;callbacks.current.onReady();}
    if(root.current)root.current.rotation.y=clock.current.angle;
    pieces.forEach((piece,i)=>{
      const arrival=(i/Math.max(1,pieces.length-1))*0.82;
      const t=Math.max(0,Math.min(1,(clock.current.build-arrival)/0.18));
      if(t<=0){scratch.pieces[i].copy(scratch.zero);return;}
      const eased=1-Math.pow(1-t,3),fly=1-eased;
      scratch.position.set(piece.position[0]+Math.sin(i*2.1)*fly*0.65,piece.position[1]+fly*4.5,piece.position[2]+Math.cos(i*1.4)*fly*0.4);
      scratch.euler.set(piece.rotation?.[0]??0,piece.rotation?.[1]??0,(piece.rotation?.[2]??0)+fly*Math.sin(i)*0.2);
      scratch.quaternion.setFromEuler(scratch.euler);scratch.scale.setScalar(0.8+eased*0.2);
      scratch.pieces[i].compose(scratch.position,scratch.quaternion,scratch.scale);
    });
    resources.batches.forEach((batch,i)=>{
      const mesh=meshes.current[i];if(!mesh)return;
      batch.instances.forEach((instance,j)=>{
        scratch.matrix.multiplyMatrices(scratch.pieces[instance.piece],instance.offset);mesh.setMatrixAt(j,scratch.matrix);
      });
      mesh.instanceMatrix.needsUpdate=true;
    });
  });
  return <group ref={root}>
    {resources.batches.map((batch,i)=><instancedMesh key={batch.id} ref={mesh=>{meshes.current[i]=mesh;}}
      args={[batch.geometry,batch.material,batch.instances.length]} frustumCulled={false} dispose={null} castShadow receiveShadow />)}
  </group>;
}

// Reuses the same geometry for original artwork exports, without an animation loop.
export function StaticLandingModel({id}:{id:LandingModelId}) {
  const model=LANDING_MODELS.find(item=>item.id===id)!;
  const stage=useRef<HTMLDivElement>(null),progress=useRef<HTMLDivElement>(null);
  return <div className="landing-sculpture" ref={stage}>
    <Canvas orthographic camera={STUDIO_CAMERA} dpr={1.5} frameloop="demand" shadows={{type:PCFShadowMap}} gl={{antialias:true,alpha:true}}>
      <StudioLight tall={id==="sailboat"} />
      <Sculpture pieces={model.pieces} active={false} reducedMotion stage={stage} progress={progress} onPhase={()=>undefined} onNext={()=>undefined} onReady={()=>{if(stage.current)stage.current.dataset.ready="true";}} />
    </Canvas>
  </div>;
}

export default function LandingSculpture({paused,reducedMotion}:{paused:boolean;reducedMotion:boolean}) {
  const [index,setIndex]=useState(0),[phase,setPhase]=useState<Phase>("building"),[ready,setReady]=useState(false);
  const [inView,setInView]=useState(true),[visible,setVisible]=useState(()=>document.visibilityState!=="hidden");
  const stage=useRef<HTMLDivElement>(null),progress=useRef<HTMLDivElement>(null);
  const model=LANDING_MODELS[reducedMotion ? 0 : index];
  const active=!paused && !reducedMotion && inView && visible;
  useEffect(()=>{
    const update=()=>setVisible(document.visibilityState!=="hidden");
    document.addEventListener("visibilitychange",update);
    const observer=new IntersectionObserver(entries=>setInView(entries[0].isIntersecting),{threshold:0.05});
    if(stage.current)observer.observe(stage.current);
    return()=>{document.removeEventListener("visibilitychange",update);observer.disconnect();};
  },[]);
  const descriptions={building:"Taking shape",complete:"Piece by piece",reversing:"Room for the next dream",empty:"Something new is coming"};
  return <figure className="landing-studio" data-model={model.id} data-phase={phase} data-ready={ready ? "true" : "false"} data-running={active ? "true" : "false"}>
    <div className="landing-studio-note" aria-hidden="true"><span className="studio-note-block" />Small steps. Real possibilities.</div>
    <div className="landing-sculpture" ref={stage} role="img" aria-label={`${model.name} made of toy bricks. An automatic building illustration, not a savings balance.`}>
      {!ready && <img className="landing-scene-poster" src="/illustrations/landing-camera.webp" width={800} height={800} alt="" />}
      <Canvas orthographic camera={STUDIO_CAMERA} dpr={[1,1.5]} frameloop={active ? "always" : "demand"}
        shadows={{type:PCFShadowMap}} gl={{antialias:true,alpha:true}} aria-hidden="true">
        <StudioLight tall={model.id==="sailboat"} />
        <Sculpture key={model.id} pieces={model.pieces} active={active} reducedMotion={reducedMotion} stage={stage} progress={progress}
          onPhase={setPhase} onReady={()=>setReady(true)} onNext={()=>setIndex(value=>(value+1)%LANDING_MODELS.length)} />
      </Canvas>
    </div>
    <figcaption className="landing-studio-caption">
      <span><small>{descriptions[phase]}</small><strong key={model.id}>{model.label}</strong></span>
      <span className="landing-studio-dots" aria-hidden="true">
        {LANDING_MODELS.map((item,i)=><i key={item.id} className={i===index ? "is-active" : ""} title={item.name} />)}
      </span>
    </figcaption>
    <div className="landing-studio-track" aria-hidden="true"><div ref={progress} /></div>
  </figure>;
}
