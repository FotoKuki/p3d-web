import Link from "next/link";
import {
  ArrowRight,
  Box,
  Calculator,
  SlidersHorizontal,
  UploadCloud,
  Mail,
  MessageCircle,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
import { auth, googleEnabled, lineEnabled } from "../auth";
import BrandLink from "./brand-link";
import styles from "./home.module.css";
import ThemeToggle from "./theme-toggle";
import { ContactPopup, ScrollMotion, WorkGallery } from "./home-interactions";
import { estimate, materials, settings } from "./pricing";
import { shippingMethods, shopLineChatUrl } from "../lib/shipping-options";

export const metadata = {
  title: "P3D Printing and Design | รับพิมพ์ 3 มิติ",
  description: "บริการพิมพ์ 3 มิติในกรุงเทพมหานคร ประเมินราคาออนไลน์ และติดต่อ P3D Printing and Design",
};

const projects = [
  { image: "fb-design-arduino-case.jpg", width: 1920, height: 1080, category: "design", title: "ออกแบบ 3D CAD เคส Arduino พร้อมจอ LCD", alt: "ภาพเรนเดอร์ 3 มิติแสดงการออกแบบประกอบชิ้นส่วนเคส Arduino และหน้าจอ LCD สีส้มตัดดำ" },
  { image: "fb-print-f1-wheel.jpg", width: 960, height: 720, category: "print", title: "พวงมาลัยรถแข่ง F1 พิมพ์ 3 มิติ (PETG)", alt: "พวงมาลัยจำลองรถแข่ง F1 พิมพ์ 3 มิติจากวัสดุ PETG สีดำ ประกอบปุ่มกดพร้อมใช้งาน" },
  { image: "fb-design-mount-tray.jpg", width: 889, height: 632, category: "design", title: "ออกแบบ 3D CAD ถาดวางและโครงยึดอุปกรณ์", alt: "ภาพเรนเดอร์โมเดล 3 มิติแสดงโครงสร้างถาดวางและจุดยึดอุปกรณ์เฉพาะทาง" },
  { image: "fb-print-itx-case.jpg", width: 1500, height: 2000, category: "print", title: "เคสคอมพิวเตอร์ ITX PC ลายเคฟล่า", alt: "เคสคอมพิวเตอร์ขนาดเล็ก ITX PC สีขาว พิมพ์ 3 มิติพร้อมช่องระบายอากาศและผิวลายเคฟล่า" },
  { image: "fb-design-curved-bracket.jpg", width: 1044, height: 768, category: "design", title: "ออกแบบ 3D CAD ขายึดและแท่นประกบฐานโค้ง", alt: "ภาพโมเดล 3D CAD แสดงรายละเอียดขายึดฐานโค้ง ร่องประกบ และรูสกรูสำหรับติดตั้ง" },
  { image: "fb-print-led-matrix.jpg", width: 720, height: 1280, category: "print", title: "เคสโมดูลไฟ LED Matrix 8×8 ตั้งโต๊ะ", alt: "กล่องอุปกรณ์ไฟ LED Matrix 8×8 พิมพ์ 3 มิติสีดำด้าน เปิดไฟแสดงผลบนโต๊ะทำงาน" },
  { image: "fb-print-mechanical-clamps.jpg", width: 960, height: 720, category: "print", title: "ชิ้นส่วนตัวยึดท่อและบูชเชิงกลความละเอียดสูง", alt: "ชุดชิ้นส่วนแคลมป์ยึดท่อ กล่องครอบ และแหวนรองสีดำที่พิมพ์ 3 มิติเสร็จแล้ว" },
  { image: "fb-print-large-arch.jpg", width: 1080, height: 1081, category: "print", title: "ชิ้นงานโครงสร้างทรงโค้งขนาดใหญ่", alt: "ชิ้นงานพิมพ์ 3 มิติสีดำทรงโค้งแนวตั้ง 2 ชิ้นบนฐานพิมพ์ของเครื่องพิมพ์ 3 มิติ" },
  { image: "architecture-work.webp", width: 850, height: 638, category: "print", title: "โมเดลสถาปัตยกรรม", alt: "โมเดลอาคารสีขาวที่พิมพ์เป็นชิ้นส่วนประกอบ" },
  { image: "assembly-prototype.webp", width: 1000, height: 1333, category: "print", title: "ชิ้นส่วนซิมูเลเตอร์การบิน", alt: "โครงแผงควบคุมและชิ้นส่วนของเครื่องจำลองการบิน" },
  { image: "keychains-work.webp", width: 850, height: 479, category: "print", title: "พวงกุญแจสั่งทำสองสี", alt: "พวงกุญแจพิมพ์สามมิติลายขาวดำ" },
];

const materialList = Object.entries(materials).map(([name, info]) => ({
  name,
  description: info.description,
  rate: `฿${info.bahtPerGram.toFixed(2)}/กรัม`,
}));

const estimateExamples = [
  { name: "ป้ายหรือพวงกุญแจ", size: "45 × 25 × 3", material: "PLA", volume: 2400 },
  { name: "ขายึดอุปกรณ์", size: "70 × 45 × 30", material: "PETG", volume: 24000 },
  { name: "เคสอุปกรณ์ตั้งโต๊ะ", size: "110 × 80 × 45", material: "PETG", volume: 72000 },
];
const bahtAmount = new Intl.NumberFormat("th-TH");

function ContactDetails() {
  return (
    <address className={styles.address}>
      <dl>
        <div>
          <dt><Phone size={15} aria-hidden="true" /> โทรศัพท์</dt>
          <dd>
            <a href="tel:+66982584742">098-258-4742</a>
            <span className={styles.contactPerson}>คุณโฟโต้</span>
          </dd>
        </div>
        <div>
          <dt><Mail size={15} aria-hidden="true" /> อีเมล</dt>
          <dd><a href="mailto:p3dprintinganddesign@gmail.com">p3dprintinganddesign@gmail.com</a></dd>
        </div>
        <div>
          <dt><MapPin size={15} aria-hidden="true" /> ที่อยู่</dt>
          <dd>กรุงเทพมหานคร, ประเทศไทย</dd>
        </div>
        <div>
          <dt><MessageCircle size={15} aria-hidden="true" /> LINE</dt>
          <dd><a href={shopLineChatUrl} target="_blank" rel="noreferrer">แชทกับ P3D</a></dd>
        </div>
        <div>
          <dt><Sparkles size={15} aria-hidden="true" /> Facebook</dt>
          <dd>
            <a href="https://www.facebook.com/share/18SjY3tfqJ/?mibextid=wwXIfr" target="_blank" rel="noreferrer">
              P3D Printing and Design
            </a>
          </dd>
        </div>
      </dl>
    </address>
  );
}

export default async function Home() {
  const session = googleEnabled || lineEnabled ? await auth() : null;
  const accountLabel = session?.user?.id ? "บัญชี" : "คลิกเพื่อล็อกอิน";
  return (
    <div className={styles.site}>
      <header className={"topbar " + styles.header}>
        <div className="topbar-inner">
          <BrandLink />
          <nav className={styles.nav} aria-label="เมนูหลัก">
            <a href="#contact">ติดต่อ</a>
            <Link href="/orders">คิวของฉัน</Link>
            <Link href="/account">{accountLabel}</Link>
            <Link href="/estimate" className={styles.navCta}>ประเมินราคา</Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <ScrollMotion />

        <section className={styles.heroWrap} aria-labelledby="home-title">
          <div className={styles.hero}>
            <div className={styles.intro}>
              <h1 id="home-title" lang="en">
                <span className={styles.titleLine}>Estimate your</span>{" "}
                <span className={styles.titleSub}>3D printing cost</span>
              </h1>
              <p className={styles.heroTranslation}>รู้ราคาพิมพ์ 3D ด้วยตัวคุณเอง</p>
              <p>พิมพ์งานต้นแบบและชิ้นส่วนสั่งทำ อัปโหลดไฟล์เพื่อดูโมเดลบนเพลตและประเมินราคาได้ทันที</p>
              <div className={styles.heroActions}>
                <Link className={styles.estimateLink} href="/estimate">
                  <span>ประเมินราคางานพิมพ์</span>
                  <ArrowRight size={20} aria-hidden="true" />
                </Link>
                <ContactPopup><ContactDetails /></ContactPopup>
              </div>
            </div>
            <div className={styles.heroMedia}>
              <img
                className={styles.heroPhoto}
                src="/workshop/print-prototype.webp"
                alt="ชิ้นงานต้นแบบสีแดงบนแผ่นพิมพ์ของเครื่องพิมพ์ 3 มิติ"
                width={960}
                height={720}
                srcSet="/workshop/print-prototype-480.webp 480w, /workshop/print-prototype-768.webp 768w, /workshop/print-prototype.webp 960w"
                sizes="(max-width: 760px) calc(100vw - 36px), (max-width: 1430px) 53vw, 728px"
                fetchPriority="high"
              />
            </div>
          </div>
          <dl className={styles.heroSpecs}>
            <div><dt>ขนาดพิมพ์สูงสุด</dt><dd>{settings.buildSize.join(" × ")} มม.</dd></div>
            <div><dt>ไฟล์ที่รองรับ</dt><dd>STL / OBJ / 3MF</dd></div>
            <div><dt>วัสดุ</dt><dd>{materialList.length} ชนิด</dd></div>
          </dl>
        </section>

        {/* Materials Capabilities Strip */}
        <section className={styles.materialsSection} aria-labelledby="materials-title" data-home-reveal>
          <div className={styles.sectionHead}>
            <div>
              <h2 id="materials-title">วัสดุที่รองรับและอัตราค่าพิมพ์</h2>
            </div>
            <Link href="/estimate" className={styles.sectionAction}>
              ทดลองคำนวณราคา <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.materialsGrid}>
            {materialList.map((mat) => (
              <div key={mat.name} className={styles.materialCard}>
                <div className={styles.materialTop}>
                  <strong>{mat.name}</strong>
                  <span>{mat.rate}</span>
                </div>
                <p>{mat.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Portfolio Gallery */}
        <section className={styles.work} id="work" aria-labelledby="work-title" data-home-reveal>
          <div className={styles.sectionHead}>
            <div>
              <h2 id="work-title">ผลงานที่ผ่านมา</h2>
            </div>
            <p className={styles.sectionNote}>คลิกที่ภาพเพื่อขยายดูรายละเอียดชิ้นงาน</p>
          </div>
          <WorkGallery projects={projects} />
          <div className={styles.estimateExamples}>
            <h3>ตัวอย่างงบค่าพิมพ์</h3>
            <p>คำนวณจากชิ้นงานสมมติ 1 ชิ้นต่อแบบ รวมค่าดำเนินการ ราคาของงานจริงขึ้นกับรูปทรงและการตั้งค่า</p>
            <ul>
              {estimateExamples.map(({ name, size, material, volume }) => {
                const quote = estimate({ volume }, { material, quantity: 1, layerHeight: .2, infill: 20, wallCount: 2, support: false });
                return <li key={name}><strong>{name}</strong><span>{material} · {size} มม.</span><span>ประมาณ ฿{bahtAmount.format(quote.total - quote.shipping)} · ค่าพิมพ์</span></li>;
              })}
            </ul>
          </div>
        </section>

        {/* Process Steps */}
        <section className={styles.steps} id="steps" aria-labelledby="steps-title" data-home-reveal>
          <div className={styles.sectionHead}>
            <div>
              <h2 id="steps-title">3 ขั้นตอนง่ายๆ ในการสั่งพิมพ์</h2>
            </div>
          </div>
          <ol className={styles.stepsGrid}>
            <li className={styles.stepCard}>
              <div className={styles.stepTop}>
                <span className={styles.stepIcon}><UploadCloud size={20} aria-hidden="true" /></span>
              </div>
              <h3>เปิดไฟล์โมเดล 3 มิติ</h3>
              <p>อัปโหลดไฟล์ STL, OBJ หรือ 3MF เพื่อหมุนดูชิ้นงาน 3 มิติและเช็กขนาดบนฐานพิมพ์ได้ทันที</p>
            </li>
            <li className={styles.stepCard}>
              <div className={styles.stepTop}>
                <span className={styles.stepIcon}><SlidersHorizontal size={20} aria-hidden="true" /></span>
              </div>
              <h3>เลือกวัสดุและค่าพิมพ์</h3>
              <p>ปรับเลือกวัสดุ สี ความหนาชั้น Infill ผนัง Support และจำนวนชิ้นตามลักษณะการใช้งาน</p>
            </li>
            <li className={styles.stepCard}>
              <div className={styles.stepTop}>
                <span className={styles.stepIcon}><Calculator size={20} aria-hidden="true" /></span>
              </div>
              <h3>ดูราคาและส่งเข้าคิวพิมพ์</h3>
              <p>รู้ราคาประเมินทันที ส่งคำสั่งพิมพ์ออนไลน์ และติดตามสถานะคิวได้ตลอด 24 ชม.</p>
            </li>
          </ol>
        </section>

        {/* FAQ */}
        <section className={styles.faq} aria-labelledby="faq-title" data-home-reveal>
          <div className={styles.faqIntro}>
            <h2 id="faq-title">คำถามที่พบบ่อย</h2>
          </div>
          <div className={styles.faqList}>
            <details>
              <summary>ไฟล์โมเดลขนาดใหญ่แค่ไหนที่ใช้ได้?</summary>
              <p>รองรับ STL, OBJ และ 3MF ขนาดไฟล์สูงสุด 20 MB และขนาดพิมพ์สูงสุด {settings.buildSize.join(" × ")} มม. ตามแนววางของชิ้นงาน</p>
            </details>
            <details>
              <summary>ต้องล็อกอินก่อนดูราคาไหม?</summary>
              <p>ประเมินราคาและลองดูโมเดล 3 มิติได้เลยโดยไม่ต้องล็อกอิน ส่วนการเข้าสู่ระบบด้วย Google หรือ LINE จะใช้ตอนส่งคำสั่งพิมพ์ บันทึกที่อยู่จัดส่ง และติดตามคิวงานของคุณ</p>
            </details>
            <details>
              <summary>ราคาคำนวณจากอะไร?</summary>
              <p>ระบบประเมินน้ำหนักวัสดุและเวลาพิมพ์จากรูปทรงและค่าที่เลือก แล้วรวมค่าแรง ค่าดำเนินการ และค่าจัดส่ง ราคาจริงอาจปรับตามผลจากโปรแกรม Slicer</p>
            </details>
            <details>
              <summary>ค่าจัดส่งและการชำระเงินเป็นอย่างไร?</summary>
              <p>ค่าจัดส่งไปรษณีย์ไทย {shippingMethods.postal.fee} บาทต่อคำสั่งพิมพ์ หรือเลือก LALAMOVE ในเขตกรุงเทพฯ แล้วจ่ายค่าจัดส่งแยกกับขนส่ง ชำระค่าพิมพ์ผ่าน PromptPay QR และแจ้งโอนพร้อมสลิปในหน้าออเดอร์ได้</p>
            </details>
            <details>
              <summary>ยังไม่มีไฟล์ 3 มิติ (STL) ให้ทางร้านออกแบบให้ได้ไหม?</summary>
              <p>ได้ครับ ทางร้านมีบริการออกแบบ 3D CAD ด้วย สามารถส่งรูปถ่าย สเก็ตช์มือ หรือขนาดชิ้นงานที่ต้องการมาทางโทรศัพท์, Facebook หรืออีเมล เพื่อให้ช่วยออกแบบและประเมินราคาได้เลย</p>
            </details>
          </div>
        </section>

        {/* Contact Section */}
        <section className={styles.contact} id="contact" aria-labelledby="contact-title" data-home-reveal>
          <div className={styles.contactCard}>
            <div className={styles.contactLead}>
              <h2 id="contact-title">ติดต่อร้าน P3D</h2>
              <p>
                มีงานด่วน ต้องการคำแนะนำเรื่องการเลือกวัสดุ หรืออยากให้ช่วยเช็กไฟล์ก่อนพิมพ์
                สามารถติดต่อสอบถามโดยตรงได้เลย
              </p>
              <div className={styles.contactCtaRow}>
                <Link href="/estimate" className={styles.estimateLink}>
                  <Box size={17} aria-hidden="true" />
                  <span>ไปหน้าประเมินราคา</span>
                </Link>
              </div>
            </div>
            <div className={styles.contactInfoBox}>
              <ContactDetails />
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <BrandLink />
            <p>P3D Printing and Design — บริการพิมพ์ 3 มิติคุณภาพสูงในกรุงเทพมหานคร</p>
          </div>
          <nav className={styles.footerLinks} aria-label="ลิงก์ท้ายเว็บ">
            <Link href="/estimate">ประเมินราคา</Link>
            <Link href="/orders">คิวของฉัน</Link>
            <Link href="/account">{accountLabel}</Link>
            <a href="#work">ผลงาน</a>
            <a href="#contact">ติดต่อ</a>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} P3D Printing and Design</span>
        </div>
      </footer>
    </div>
  );
}
