import brandmark from "./brand/brandmark.svg";
import payCode from "./brand/pay-code.png";

export function ScanCode() {
  return (
    <div className="paycode-disc">
      <img className="paycode-qr" src={payCode} alt="Scan to pay one rupee" />
      <img className="paycode-logo" src={brandmark} alt="" />
    </div>
  );
}
