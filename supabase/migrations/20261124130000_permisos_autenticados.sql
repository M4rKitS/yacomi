-- Permisos de tabla para usuarios con sesión iniciada.
-- RLS sigue limitando cada fila a su dueño; los visitantes sin sesión (anon) no tienen acceso.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.foods, public.dishes, public.dish_items, public.meals,
  public.weights, public.measurements, public.goals
  to authenticated;
grant execute on function public.corregir_comidas_de_alimento(uuid) to authenticated;
revoke execute on function public.corregir_comidas_de_alimento(uuid) from anon, public;
