import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/database";

export async function POST(request) {
  const { email, password, fullName } = await request.json();

  const db = initializeDatabase();

  const userExists = db.prepare("SELECT id FROM users WHERE email = ?");
  const userExistsResult = userExists.get(email);

  console.log("Checking if user exists:", email);

  if (userExistsResult) {
    console.log("User already exists");
    db.close();
    return NextResponse.json({ error: "User already exists" }, { status: 400 });
  } else {
    const createUser = db.prepare(
      "INSERT INTO users (email, password, name) VALUES (?, ?, ?)"
    );

    const argon2 = require("argon2");
    const hashedPassword = await argon2.hash(password);

    try {
      const info = createUser.run(email, hashedPassword, fullName);
      console.log("User created with ID:", info.lastInsertRowid);
      
      db.close();
      
      return NextResponse.json(
        { message: "User created successfully", userId: info.lastInsertRowid },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error creating user:", error);
      db.close();
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }
  }
}