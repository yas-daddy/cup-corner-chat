import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "WC26 — Games" },
      { name: "description", content: "World Cup trivia, daily." },
    ],
  }),
  component: () => <Outlet />,
});
