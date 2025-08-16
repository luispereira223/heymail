
import { NextResponse } from 'next/server'
// zqvc ckyr sboa bczw 
// https://myaccount.google.com/apppasswords

export async function POST(request) {
    const { email, appPassword, imapSettings } = await request.json();
    console.log('entered add account method');
    console.log(email);
    console.log(appPassword);
    console.log(imapSettings);





    return NextResponse.json({ message: 'Hello World' })
}