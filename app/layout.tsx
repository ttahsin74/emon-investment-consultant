import './globals.css';
export const metadata={title:'Client Management System',description:'Simple full-stack CRM built with Next.js and SQLite',icons:{icon:'/icon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
