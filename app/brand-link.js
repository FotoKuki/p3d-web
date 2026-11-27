import Link from "next/link";

export default function BrandLink() {
  return (
    <Link href="/" className="brand" aria-label="P3D หน้าแรก">
      <span className="brand-logo" aria-hidden="true" />
    </Link>
  );
}
