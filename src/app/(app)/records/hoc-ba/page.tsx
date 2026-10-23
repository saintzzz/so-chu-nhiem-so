import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { mustRows } from "@/lib/supabase/must";
import { hasRole } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { getClassYearEndBundles, getStudentYearEndBundle } from "@/lib/hocba";
import {
  HocBaClassList,
  HocBaDetail,
} from "@/components/records/hoc-ba-explorer";
import type { ClassRoom } from "@/types";

export default async function HocBaPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string; class?: string; student?: string }>;
}) {
  const profile = await requireRoles(["gvcn", "bgh", "pht", "so_gd", "ubnd"]);
  const { school, class: classParam, student } = await searchParams;
  const supabase = await createClient();

  const isDept = hasRole(profile, "so_gd") || hasRole(profile, "ubnd");
  const isPhtOnly = hasRole(profile, "pht") && !hasRole(profile, "bgh");

  // ---- School picker (chi dept) ----
  let schools: { id: string; name: string }[] = [];
  if (isDept) {
    const { rows } = mustRows(
      await fetchAllRows<{ id: string; name: string }>((f, t) =>
        supabase.from("schools").select("id,name").order("name").range(f, t),
      ),
      "hocba/schools",
    );
    schools = rows;
  }
  const schoolId = isDept ? school ?? schools[0]?.id : profile.school_id;

  // ---- Class picker ----
  let classes: Pick<ClassRoom, "id" | "name" | "campus_id" | "academic_year_id">[] = [];
  if (schoolId) {
    let q = supabase
      .from("classes")
      .select("id,name,campus_id,academic_year_id")
      .eq("school_id", schoolId);
    if (hasRole(profile, "gvcn")) q = q.eq("gvcn_id", profile.id);
    const { rows } = mustRows(
      await fetchAllRows<Pick<ClassRoom, "id" | "name" | "campus_id" | "academic_year_id">>(
        (f, t) => q.order("name").range(f, t),
      ),
      "hocba/classes",
    );
    classes = rows;
    // PHT thuan: chi lop thuoc phan hieu minh phu trach (khop RLS bundle).
    if (isPhtOnly && profile.campus_id) {
      classes = classes.filter((c) => c.campus_id === profile.campus_id);
    }
  }
  // classParam chi hop le neu nam trong danh sach lop role nhin thay;
  // khong fallback lang ve classes[0] (lot URL -> xem lop ngoai pham vi).
  const selectedClass = classParam
    ? (classes.find((c) => c.id === classParam) ?? null)
    : (classes[0] ?? null);

  // classParam duoc truyen nhung khong nam trong pham vi nhin thay -> chan som.
  if (classParam && !selectedClass) {
    return (
      <div>
        <PageHeader section="Hồ sơ lớp học" title="Học bạ số" />
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Lớp này không thuộc phạm vi của bạn hoặc không tồn tại.
        </p>
      </div>
    );
  }

  const canWrite =
    hasRole(profile, "gvcn") &&
    !!selectedClass &&
    (await isOwnClass(profile.id, selectedClass.id));
  const isBgh = hasRole(profile, "bgh");

  // ---- Detail view ----
  if (student && selectedClass && selectedClass.academic_year_id) {
    const bundle = await getStudentYearEndBundle(
      student,
      selectedClass.academic_year_id,
    );
    // HS phai thuoc dung lop dang xem - chan GVCN lop khac doc bang URL.
    const denied = !bundle || bundle.student.class_id !== selectedClass.id;
    return (
      <div>
        <PageHeader section="Hồ sơ lớp học" title="Học bạ số" />
        {denied ? (
          <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Không tải được học bạ học sinh này.
          </p>
        ) : (
          <HocBaDetail
            bundle={bundle}
            className={selectedClass.name}
            yearId={selectedClass.academic_year_id}
            canWrite={canWrite}
            canApprove={isBgh}
            exportable={canWrite || isBgh}
            baseQuery={`?class=${selectedClass.id}`}
          />
        )}
      </div>
    );
  }

  // ---- List view ----
  const { bundles, yearId } = selectedClass
    ? await getClassYearEndBundles(selectedClass.id)
    : { bundles: [], yearId: null };

  return (
    <div>
      <PageHeader
        section="Hồ sơ lớp học"
        title="Học bạ số"
        description="Xếp loại cuối năm, quyết định lên lớp và phê duyệt theo Thông tư 22/2021."
      />
      <HocBaClassList
        schools={isDept ? schools : []}
        selectedSchoolId={schoolId ?? null}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        selectedClassId={selectedClass?.id ?? null}
        bundles={bundles}
        canWrite={canWrite}
        isBgh={isBgh}
        yearId={yearId}
      />
    </div>
  );
}

async function isOwnClass(profileId: string, classId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("gvcn_id", profileId)
    .maybeSingle();
  if (error) throw new Error(`Không tải được dữ liệu nguồn (classes).`);
  return !!data;
}
