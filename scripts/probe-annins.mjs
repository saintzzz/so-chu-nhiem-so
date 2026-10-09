import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim().replace(/^"|"$/g,"")]));
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth } = await c.auth.signInWithPassword({ email: "anhptl@nd.scn", password: "demo1234" });
const { data: me } = await c.from("profiles").select("id,school_id").eq("id", auth.user.id).single();
const { data: cls } = await c.from("classes").select("id,name").eq("gvcn_id", me.id);
console.log("my classes:", cls?.map(x=>x.name));
const { data: ins, error } = await c.from("announcements").insert({
  sender_id: auth.user.id, school_id: me.school_id, class_id: cls[0].id,
  student_id: null, title: "PROBE INS", content: "probe",
}).select("id");
console.log("insert:", JSON.stringify(ins), "err:", JSON.stringify(error));
if (ins?.[0]) await c.from("announcements").delete().eq("id", ins[0].id);
const { data: roles } = await c.rpc("my_roles").catch(() => ({ data: null }));
console.log("my_roles:", roles);
