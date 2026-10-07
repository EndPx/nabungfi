use anchor_lang_idl::build::IdlBuilder;
use std::{env, fs, path::PathBuf};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = env::args().skip(1);
    let program = PathBuf::from(args.next().ok_or("missing program path")?);
    let package = args.next().ok_or("missing package")?;
    let output = PathBuf::from(args.next().ok_or("missing output path")?);
    let resolution = match package.as_str() {
        "nabungfi-multi" => true,
        // The pinned Endpoint account-resolution macro references sibling fields
        // out of scope. Account lists and argument types remain generated.
        "nabungfi-multi-lz" => false,
        _ => return Err("unsupported program package".into()),
    };
    // Cargo propagates its toolchain. Avoid the 0.1.4 builder's redundant rustup
    // installation branch; the child cargo still uses the installed toolchain.
    env::remove_var("RUSTUP_TOOLCHAIN");
    let idl = IdlBuilder::new()
        .program_path(program.canonicalize()?)
        .resolution(resolution)
        .cargo_args(vec!["--locked".into(), "-p".into(), package])
        .build()?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&output, serde_json::to_string_pretty(&idl)? + "\n")?;
    println!(
        "Generated {}: {} instructions",
        output.display(),
        idl.instructions.len()
    );
    Ok(())
}
