import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("dishes", "routes/dishes._index.tsx"),
  route("dishes/new", "routes/dishes.new.tsx"),
  route("dishes/:id", "routes/dishes.$id.tsx"),
  route("suggest", "routes/suggest.tsx"),
  route("plan", "routes/plan.tsx"),
  route("grocery", "routes/grocery.tsx"),
  route("resources/suggest", "routes/resources.suggest.tsx"),
  route("resources/dish-from-name", "routes/resources.dish-from-name.tsx"),
] satisfies RouteConfig;
