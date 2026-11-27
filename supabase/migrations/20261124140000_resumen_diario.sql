-- Totales por día para Hoy (racha), Diario y Progreso, sin traer cada comida.
create view public.resumen_diario
with (security_invoker = true) as
select
  user_id,
  eaten_on,
  sum(kcal)::integer            as kcal,
  round(sum(protein), 1)        as protein,
  round(sum(carbs), 1)          as carbs,
  round(sum(fat), 1)            as fat,
  count(*)::integer             as comidas
from public.meals
group by user_id, eaten_on;

grant select on public.resumen_diario to authenticated;
