const{neon}=require('@neondatabase/serverless');
require('dotenv').config({path:require('path').join(__dirname,'..', '.env.local')});
const sql=neon(process.env.DATABASE_URL);
(async()=>{
  const r=await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  const t=await sql`SELECT COUNT(*) as c FROM cs_products`;
  console.log('Missing:',r[0].c,'/ Total:',t[0].c,'Coverage:',Math.round((1-r[0].c/t[0].c)*100)+'%');
})();
