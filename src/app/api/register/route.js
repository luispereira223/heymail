import { NextResponse } from "next/server";

export async function POST(request) {
  const { email, password, fullName } = await request.json();

  const db = require("better-sqlite3")("emails.db");

  db.exec(
    "CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, password TEXT, name TEXT)"
  );

  const userExists = db.prepare("SELECT * FROM users WHERE email = ?");
  const userExistsResult = userExists.get(email);

  console.log(userExistsResult);

  if (userExistsResult) {
    console.log("User already exists");
    return NextResponse.json({ error: "User already exists" }, { status: 400 });
  } else {
    const createuser = db.prepare(
      "INSERT INTO users (email, password, name) VALUES (?, ?, ?)"
    );

    const argon2 = require("argon2");
    const hashed_password = await argon2.hash(password);

    const info = createuser.run(email, hashed_password, fullName);

    console.log(info);
    return NextResponse.json(
      { message: "User created successfully" },
      { status: 201 }
    );
  }
}
