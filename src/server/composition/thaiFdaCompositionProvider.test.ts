import assert from "node:assert/strict";
import test from "node:test";
import { parseThaiFdaCandidates } from "./thaiFdaCompositionProvider";

test("Thai FDA product cards are parsed into authoritative composition candidates", () => {
  const html = `
    <div class="col-md-4 col-sm-6" style="margin-bottom: 15px">
      <table>
        <tr><td><strong>ชื่อสารสำคัญ : </strong></td><td><span>chlorpheniramine+paracetamol+phenylephrine</span></td></tr>
        <tr><td><strong>ชื่อทางการค้า : </strong></td><td><span>TIFFY DEY</span></td></tr>
        <tr><td><strong>รูปแบบ : </strong></td><td><span>tablet</span></td></tr>
        <tr><td><strong>ความแรง : </strong></td><td><span>2 MG+500 MG+10 MG</span></td></tr>
        <tr><td><strong>ผู้รับอนุญาต : </strong></td><td><span>ไทยนครพัฒนา จำกัด, บริษัท</span></td></tr>
        <tr><td><strong>เลขทะเบียน : </strong></td><td><span>2A 3/52</span></td></tr>
      </table>
      <a href="https://ndi.fda.moph.go.th/drug_detail/index/?rctype=2A&amp;rcno=5200003">รายละเอียดเพิ่มเติม</a>
    </div>
  `;

  assert.deepEqual(parseThaiFdaCandidates(html), [{
    genericName: "chlorpheniramine+paracetamol+phenylephrine",
    brandName: "TIFFY DEY",
    dosageForm: "tablet",
    strength: "2 MG+500 MG+10 MG",
    manufacturerName: "ไทยนครพัฒนา จำกัด, บริษัท",
    registrationNumber: "2A 3/52",
    detailUrl: "https://ndi.fda.moph.go.th/drug_detail/index/?rctype=2A&rcno=5200003",
  }]);
});
