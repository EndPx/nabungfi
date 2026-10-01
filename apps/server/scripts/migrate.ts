import {loadAppConfig,loadLocalEnvironment} from '../src/config.js';
import {neonDatabase,migrateDatabase} from '../src/database.js';
loadLocalEnvironment();const db=neonDatabase(loadAppConfig().databaseUrl);
try{
 const schemas=await db.query("SELECT DISTINCT table_schema FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')");
 if(schemas.rows.some(r=>r.table_schema!=='nabungfi'))throw new Error('Unexpected application schema');
 await migrateDatabase(db);await migrateDatabase(db);
 const versions=await db.query('SELECT version FROM nabungfi.schema_migrations ORDER BY version');
 console.log(JSON.stringify({migrationVersions:versions.rows.map(r=>r.version),repeatRunIdempotent:true,scope:'nabungfi schema only',destructiveOperations:0}));
}catch{console.error('Application migration failed; preserve schema and inspect privately.');process.exitCode=1;}finally{await db.close();}
