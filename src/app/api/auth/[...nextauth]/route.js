import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { initializeDatabase } from "@/lib/database";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET, // Explicitly set the secret
  
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },

      authorize: async (credentials) => {
        // Basic guard
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials.");
        }

        // Open DB
        let db;
        
        try {
          db = initializeDatabase();

          // Find user by email
          const getUser = db.prepare("SELECT id, email, password, name FROM users WHERE email = ?");
          const userRow = getUser.get(credentials.email);

          if (!userRow) {
            throw new Error("Invalid credentials.");
          }

          // Verify password with argon2
          const argon2 = require("argon2");
          const isValid = await argon2.verify(userRow.password, credentials.password);

          if (!isValid) {
            throw new Error("Invalid credentials.");
          }

          // SUCCESS — return user object
          const user = {
            id: userRow.id.toString(),
            email: userRow.email,
            name: userRow.name,
          };

          console.log("Authentication successful for user:", user.email);
          return user;

        } catch (error) {
          console.error("Authorization error:", error);
          throw error;
        } finally {
          if (db) {
            db.close();
          }
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
      }
      return session;
    },
  },

  pages: {
    signIn: "/", // Redirect to home page for sign in
  },
});

export const { POST, GET } = handlers;