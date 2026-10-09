import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim().replace(/^"|"$/g,"")]));
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: p } = await a.from("profiles").select("id,role,concurrent_roles,school_id").eq("email","minhtv@nd.scn").single();
console.log("minhtv:", p);
const { data: cls } = await a.from("classes").select("id,name").eq("name","6A3");
console.log("6A3:", cls);
if (cls?.length) {
  const { data: tt } = await a.from("timetable_entries").select("subject_id,teacher_id").eq("class_id", cls[0].id).eq("teacher_id", p.id);
  console.log("minhtv teaches 6A3 entries:", (tt??[]).length);
  const { data: ttAll } = await a.from("timetable_entries").select("class_id").eq("teacher_id", p.id);
  const ids = [...new Set((ttAll??[]).map(t=>t.class_id))];
  const { data: names } = await a.from("classes").select("name").in("id", ids);
  console.log("minhtv classes:", (names??[]).map(n=>n.name).join(","));
}
