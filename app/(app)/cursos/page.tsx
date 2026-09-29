import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { requireSuperadmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { CourseForm } from "./course-form";
import { deleteCourse, renameCourse } from "./actions";

export const metadata: Metadata = { title: "Cursos" };
export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  await requireSuperadmin();
  const courses = await query<{ id: number; name: string; students: number }>(
    `SELECT c.id, c.name, (SELECT count(*) FROM students s WHERE s.course = c.name)::int AS students
       FROM courses c ORDER BY c.name`,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Cursos</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Los cursos se crean acá una sola vez; después se eligen de la lista al cargar alumnos.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section className="card overflow-hidden">
          {courses.length === 0 ? (
            <p className="p-8 text-center text-[color:var(--muted)]">Todavía no creaste ningún curso.</p>
          ) : (
            <ul className="divide-y divide-brand-100">
              {courses.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                  <form action={renameCourse} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="name" defaultValue={c.name} required maxLength={40} className="input !w-40" aria-label={`Nombre del curso ${c.name}`} />
                    <button className="btn btn-ghost btn-sm">Renombrar</button>
                    <span className="text-xs text-[color:var(--muted)]">{c.students} alumnos</span>
                  </form>
                  {c.students === 0 && (
                    <form action={deleteCourse}>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmButton message={`¿Eliminar el curso ${c.name}?`} title="Eliminar curso">
                        <Trash2 className="size-4" /><span className="sr-only">Eliminar</span>
                      </ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <CourseForm />
      </div>
    </div>
  );
}
