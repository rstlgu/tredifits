import "./styles.css";

export const metadata = {
  title: "Outfit Motion Lab",
  description: "Generate 5 second Seedance outfit rotations"
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
