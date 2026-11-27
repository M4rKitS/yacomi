"""Genera el SQL que importa los datos de la app iOS (M4rkcal) en Supabase.

Uso: python3 scripts/generar_importacion.py ENTRADA.json SALIDA.sql
El SQL resultante contiene datos personales: no se guarda en el repo.
Se ejecuta en el SQL Editor de Supabase cuando ya existe el único usuario.
"""
import json
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

ZONA = ZoneInfo("Europe/Helsinki")


def q(v):
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return repr(round(v, 2)) if isinstance(v, float) else str(v)
    return "'" + str(v).replace("'", "''") + "'"


def dia_local(iso):
    return datetime.fromisoformat(iso).astimezone(ZONA).date().isoformat()


def main(entrada, salida):
    d = json.load(open(entrada))
    sql = [
        "-- Importación de M4rkcal a YaComí. Ejecutar una sola vez; se puede repetir sin duplicar.",
        "begin;",
        "do $$ begin",
        "  if (select count(*) from auth.users) <> 1 then",
        "    raise exception 'Debe haber exactamente un usuario en auth.users';",
        "  end if;",
        "end $$;",
        "",
    ]

    # Despensa
    filas = [f"({q(a['id'])}, {q(a['nombre'].strip())}, {q(a['kcal_100g'])}, {q(a['proteina_100g'] or 0)})"
             for a in d["alimentos"]]
    sql.append("insert into public.foods (id, name, kcal_100g, protein_100g, user_id)\n"
               "select v.id::uuid, v.name, v.k, v.p, (select id from auth.users limit 1) from (values\n  "
               + ",\n  ".join(filas) + "\n) as v(id, name, k, p)\non conflict (id) do nothing;\n")

    # Comidas
    filas = []
    for m in d["comidas"]:
        filas.append("(" + ", ".join([
            q(m["id"]), q(m["fecha"]), q(dia_local(m["fecha"])), q(m["categoria"]),
            q(m["nombre"].strip()), q(m["gramos"]), q(int(m["kcal"])), q(m["proteina"] or 0),
            q(m["kcal_100g"]), q(m["proteina_100g"]),
        ]) + ")")
    sql.append(
        "insert into public.meals (id, eaten_at, eaten_on, category, name, grams, kcal, protein,"
        " kcal_100g, protein_100g, source, user_id)\n"
        "select v.id::uuid, v.t::timestamptz, v.d::date, v.c::public.categoria_comida, v.n, v.g, v.k, v.p,"
        " v.k100, v.p100, 'importado', (select id from auth.users limit 1) from (values\n  "
        + ",\n  ".join(filas) + "\n) as v(id, t, d, c, n, g, k, p, k100, p100)\non conflict (id) do nothing;\n")

    # Enlaza cada comida con su alimento de la despensa (mismo nombre)
    sql.append(
        "update public.meals m set food_id = f.id\n"
        "from public.foods f\n"
        "where m.food_id is null and m.source = 'importado'\n"
        "  and f.user_id = m.user_id and lower(f.name) = lower(m.name);\n")

    # Peso: uno por día local, el último apuntado
    pesos = {}
    for p in sorted(d["pesos"], key=lambda p: p["fecha"]):
        pesos[dia_local(p["fecha"])] = p
    filas = [f"({q(p['id'])}, {q(dia)}, {q(p['peso_kg'])})" for dia, p in sorted(pesos.items())]
    sql.append("insert into public.weights (id, measured_on, weight_kg, user_id)\n"
               "select v.id::uuid, v.d::date, v.w, (select id from auth.users limit 1) from (values\n  "
               + ",\n  ".join(filas) + "\n) as v(id, d, w)\non conflict do nothing;\n")

    # Medidas: una por día local
    medidas = {}
    for m in sorted(d["medidas"], key=lambda m: m["fecha"]):
        medidas[dia_local(m["fecha"])] = m
    filas = [f"({q(m['id'])}, {q(dia)}, {q(m['cintura_cm'])}, {q(m['pecho_cm'])}, {q(m['muslo_cm'])}, {q(m['cadera_cm'])})"
             for dia, m in sorted(medidas.items())]
    sql.append("insert into public.measurements (id, measured_on, waist_cm, chest_cm, thigh_cm, hip_cm, user_id)\n"
               "select v.id::uuid, v.d::date, v.w, v.c, v.t, v.h, (select id from auth.users limit 1) from (values\n  "
               + ",\n  ".join(filas) + "\n) as v(id, d, w, c, t, h)\non conflict do nothing;\n")

    # Objetivos
    o = d["objetivos"][0]
    sql.append("insert into public.goals (user_id, kcal_min, kcal_max, protein_g, maintenance_kcal)\n"
               f"select id, {q(o['kcal_min'])}, {q(o['kcal_max'])}, {q(o['proteina_g'])}, {q(o['mantenimiento_kcal'])} from auth.users\n"
               "on conflict (user_id) do nothing;\n")

    sql.append("commit;\n")
    sql.append("select\n  (select count(*) from public.foods) as alimentos,\n"
               "  (select count(*) from public.meals) as comidas,\n"
               "  (select count(*) from public.meals where food_id is not null) as comidas_enlazadas,\n"
               "  (select count(*) from public.weights) as pesos,\n"
               "  (select count(*) from public.measurements) as medidas,\n"
               "  (select count(*) from public.goals) as objetivos;\n")
    open(salida, "w").write("\n".join(sql))
    print(f"alimentos {len(d['alimentos'])} · comidas {len(d['comidas'])} · "
          f"pesos {len(d['pesos'])}→{len(pesos)} · medidas {len(d['medidas'])}→{len(medidas)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
