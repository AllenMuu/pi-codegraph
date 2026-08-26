export interface User {
  id: string;
  name: string;
}

export function authenticate(token: string): User | null {
  if (token === "secret") {
    return { id: "1", name: "Alice" };
  }
  return null;
}
