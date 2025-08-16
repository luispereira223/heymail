import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },

      authorize: async (credentials) => {
        // basic guard
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials.");
        }

        // open DB (better-sqlite3)
        const Database = require("better-sqlite3");
        const db = Database("emails.db");

        // find user by email
        const getUser = db.prepare("SELECT * FROM users WHERE email = ?");
        const userRow = getUser.get(credentials.email);

        if (!userRow) {
          // no user with that email
          throw new Error("Invalid credentials.");
        }

        // verify password with argon2
        const argon2 = require("argon2");
        const isValid = await argon2.verify(userRow.password, credentials.password);

        if (!isValid) {
          // wrong password
          throw new Error("Invalid credentials.");
        }

        // SUCCESS — return a non-null user object (no id/email returned)
        const user = {
          name: userRow.full_name || "User",
          // you can add other non-sensitive flags here if needed, e.g. role
          // role: userRow.role || 'user',
        };

        console.log("authorize: returning user =>", user);
        return user;
      },
    }),
  ],

  // Note: intentionally no callbacks, no session/jwt customization — simple setup
});

export const { POST, GET } = handlers;
