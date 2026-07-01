export type Customer = {
  id: string;
  name: string;
  mobile: string;
  avatarUrl?: string;
  isMember: boolean;
  frequentProductIds: string[];
};

export type ProductBatch = {
  batchNo: string;
  expiryDate: string;
  sellPriceThb: number;
  availableStock: number;
};

export type SalesProduct = {
  id: string;
  itemName: string;
  brandName: string;
  unit: string;
  location: string;
  shortCode: string;
  internalCode: string;
  barcode: string;
  categoryShortcut: string;
  category: string;
  imageUrl: string;
  weeklySold: number;
  batches: ProductBatch[];
};

export type RecentSale = {
  id: string;
  billNo: string;
  billDate: string;
  customerName: string;
  pharmacistName: string;
  paymentMethod: string;
  totalQuantity: number;
  uniqueItems: number;
  netPayableThb: number;
  status: "Paid" | "Draft" | "Voided";
};

export const customers: Customer[] = [
  {
    id: "cus-001",
    name: "Narin Chaiyaporn",
    mobile: "081-234-7788",
    avatarUrl: "https://placehold.co/96x96/png?text=NC",
    isMember: true,
    frequentProductIds: ["p-sara", "p-tiffy", "p-airx", "p-ors", "p-betadine", "p-smooth-e"],
  },
  {
    id: "cus-002",
    name: "Supansa Kittikul",
    mobile: "089-445-1120",
    avatarUrl: "https://placehold.co/96x96/png?text=SK",
    isMember: true,
    frequentProductIds: ["p-blackmores-c", "p-natc", "p-nivea-sun", "p-dentiste", "p-nexcare"],
  },
  {
    id: "cus-003",
    name: "Walk-in Customer",
    mobile: "",
    isMember: false,
    frequentProductIds: [],
  },
];

export const salesProducts: SalesProduct[] = [
  {
    id: "p-sara",
    itemName: "Sara Paracetamol 500 mg Tablet",
    brandName: "Sara",
    unit: "Blister pack",
    location: "A1-02",
    shortCode: "sa",
    internalCode: "g+01",
    barcode: "8850001000014",
    categoryShortcut: "c",
    category: "Pain Relief",
    imageUrl: "https://i0.wp.com/lifeplusmm.com/wp-content/uploads/2023/06/60201021.png?fit=1600%2C1600&ssl=1",
    weeklySold: 342,
    batches: [
      { batchNo: "SAR25041", expiryDate: "2027-01-31", sellPriceThb: 40, availableStock: 42 },
      { batchNo: "SAR25088", expiryDate: "2027-07-31", sellPriceThb: 40, availableStock: 86 },
      { batchNo: "SAR26012", expiryDate: "2028-02-28", sellPriceThb: 42, availableStock: 120 },
    ],
  },
  {
    id: "p-tylenol",
    itemName: "Tylenol 500 mg Caplet",
    brandName: "Tylenol",
    unit: "Blister pack",
    location: "A1-04",
    shortCode: "ty",
    internalCode: "g+02",
    barcode: "8850001000021",
    categoryShortcut: "c",
    category: "Pain Relief",
    imageUrl: "https://bangpleestationery.com/wp-content/uploads/2023/12/%E0%B9%84%E0%B8%97%E0%B8%A5%E0%B8%B4%E0%B8%99%E0%B8%AD%E0%B8%A5-500mg-.jpg",
    weeklySold: 188,
    batches: [
      { batchNo: "TYL25019", expiryDate: "2027-03-15", sellPriceThb: 48, availableStock: 32 },
      { batchNo: "TYL25111", expiryDate: "2027-11-30", sellPriceThb: 48, availableStock: 64 },
    ],
  },
  {
    id: "p-tiffy",
    itemName: "Tiffy Dey Cold Tablet",
    brandName: "Tiffy",
    unit: "Blister pack",
    location: "B2-01",
    shortCode: "tf",
    internalCode: "g+03",
    barcode: "8850001000038",
    categoryShortcut: "a",
    category: "Allergy & Cold",
    imageUrl: "https://webassets.lyreco.com/products/356/606/2356606.jpg?checksum=4069607461&width=430&shape=square",
    weeklySold: 301,
    batches: [
      { batchNo: "TFY25022", expiryDate: "2026-12-31", sellPriceThb: 25, availableStock: 55 },
      { batchNo: "TFY25091", expiryDate: "2027-09-30", sellPriceThb: 25, availableStock: 110 },
    ],
  },
  {
    id: "p-zyrtec",
    itemName: "Zyrtec Cetirizine 10 mg Tablet",
    brandName: "Zyrtec",
    unit: "Blister pack",
    location: "B2-03",
    shortCode: "zy",
    internalCode: "g+04",
    barcode: "8850001000045",
    categoryShortcut: "a",
    category: "Allergy & Cold",
    imageUrl: "https://image.makewebeasy.net/makeweb/m_1920x0/VaejmKzLQ/DefaultData/%E0%B8%A3%E0%B8%B9%E0%B8%9B_YAA_DD_2024_09_12T164835_551.png?v=202405291424",
    weeklySold: 156,
    batches: [
      { batchNo: "ZYR25008", expiryDate: "2027-04-30", sellPriceThb: 220, availableStock: 18 },
      { batchNo: "ZYR25144", expiryDate: "2028-02-28", sellPriceThb: 225, availableStock: 24 },
    ],
  },
  {
    id: "p-airx",
    itemName: "Air-X Simethicone Chewable Tablet",
    brandName: "Air-X",
    unit: "Blister pack",
    location: "C1-01",
    shortCode: "ax",
    internalCode: "g+05",
    barcode: "8850001000069",
    categoryShortcut: "g",
    category: "Gastrointestinal",
    imageUrl: "https://cdn.yamibuy.net/item/83c85c2565f4a2437335470498c5bd06_750x750.webp",
    weeklySold: 274,
    batches: [
      { batchNo: "AIR25014", expiryDate: "2027-02-28", sellPriceThb: 35, availableStock: 70 },
      { batchNo: "AIR25102", expiryDate: "2028-01-31", sellPriceThb: 35, availableStock: 96 },
    ],
  },
  {
    id: "p-gaviscon",
    itemName: "Gaviscon Double Action Liquid Sachet",
    brandName: "Gaviscon",
    unit: "Sachet",
    location: "C1-03",
    shortCode: "gy",
    internalCode: "g+99",
    barcode: "93483924388",
    categoryShortcut: "g",
    category: "Gastrointestinal",
    imageUrl: "https://discountchemist.com.au/wp-content/uploads/2019/07/5683.png",
    weeklySold: 226,
    batches: [
      { batchNo: "GAV25033", expiryDate: "2027-06-30", sellPriceThb: 18, availableStock: 140 },
      { batchNo: "GAV26001", expiryDate: "2028-04-30", sellPriceThb: 18, availableStock: 220 },
    ],
  },
  {
    id: "p-ors",
    itemName: "Oreda R.O. Oral Rehydration Salts",
    brandName: "Oreda R.O.",
    unit: "Sachet",
    location: "C1-05",
    shortCode: "or",
    internalCode: "g+07",
    barcode: "8850001000083",
    categoryShortcut: "g",
    category: "Gastrointestinal",
    imageUrl: "https://doctorthailand.net/wp-content/uploads/2018/08/5d154b501cd4a.jpeg",
    weeklySold: 294,
    batches: [
      { batchNo: "ORS25077", expiryDate: "2027-08-01", sellPriceThb: 10, availableStock: 210 },
      { batchNo: "ORS26010", expiryDate: "2028-05-01", sellPriceThb: 10, availableStock: 180 },
    ],
  },
  {
    id: "p-blackmores-c",
    itemName: "Blackmores Bio C 1000 Tablet",
    brandName: "Blackmores",
    unit: "Bottle",
    location: "D1-01",
    shortCode: "bc",
    internalCode: "g+08",
    barcode: "8850001000106",
    categoryShortcut: "v",
    category: "Vitamins & Supplements",
    imageUrl: "https://cdn11.bigcommerce.com/s-js3ghti4c3/images/stencil/400x500/products/799/43706/14140070592542__86311.1762320509.1280.1280_1775114625__70828.1775137067.png?c=2",
    weeklySold: 122,
    batches: [
      { batchNo: "BLC25060", expiryDate: "2027-10-31", sellPriceThb: 590, availableStock: 15 },
      { batchNo: "BLC26021", expiryDate: "2028-08-31", sellPriceThb: 590, availableStock: 22 },
    ],
  },
  {
    id: "p-natc",
    itemName: "MEGA We Care Nat C 1000 Tablet",
    brandName: "MEGA We Care",
    unit: "Bottle",
    location: "D1-03",
    shortCode: "nc",
    internalCode: "g+09",
    barcode: "8850001000113",
    categoryShortcut: "v",
    category: "Vitamins & Supplements",
    imageUrl: "https://medias.watsons.co.th/publishing/WTCTH-316035-front-zoom.jpg?version=1739214686&imageresize=358_358",
    weeklySold: 147,
    batches: [
      { batchNo: "NAT25017", expiryDate: "2027-12-31", sellPriceThb: 260, availableStock: 28 },
      { batchNo: "NAT26002", expiryDate: "2028-09-30", sellPriceThb: 260, availableStock: 36 },
    ],
  },
  {
    id: "p-betadine",
    itemName: "Betadine Povidone-Iodine Solution 30 ml",
    brandName: "Betadine",
    unit: "Bottle",
    location: "E1-02",
    shortCode: "bd",
    internalCode: "g+10",
    barcode: "8850001000137",
    categoryShortcut: "f",
    category: "First Aid",
    imageUrl: "https://d48n7irf.cdn.imgeng.in/images/default-source/th/products/wound-care/btd-solution-oct23_15cc-4.png?sfvrsn=8280c4d0_4",
    weeklySold: 133,
    batches: [
      { batchNo: "BET25002", expiryDate: "2028-01-09", sellPriceThb: 55, availableStock: 48 },
      { batchNo: "BET26022", expiryDate: "2028-12-31", sellPriceThb: 55, availableStock: 72 },
    ],
  },
  {
    id: "p-nexcare",
    itemName: "3M Nexcare Waterproof Plaster",
    brandName: "Nexcare",
    unit: "Box",
    location: "E1-04",
    shortCode: "nx",
    internalCode: "g+11",
    barcode: "8850001000151",
    categoryShortcut: "f",
    category: "First Aid",
    imageUrl: "https://placehold.co/360x360/png?text=Nexcare",
    weeklySold: 98,
    batches: [
      { batchNo: "NEX25041", expiryDate: "2028-03-31", sellPriceThb: 120, availableStock: 30 },
      { batchNo: "NEX26007", expiryDate: "2029-01-31", sellPriceThb: 120, availableStock: 44 },
    ],
  },
  {
    id: "p-smooth-e",
    itemName: "Smooth E Cream 15 g",
    brandName: "Smooth E",
    unit: "Tube",
    location: "S2-01",
    shortCode: "se",
    internalCode: "g+12",
    barcode: "8850001000175",
    categoryShortcut: "s",
    category: "Skincare",
    imageUrl: "https://placehold.co/360x360/png?text=Smooth+E",
    weeklySold: 114,
    batches: [
      { batchNo: "SME25080", expiryDate: "2027-11-30", sellPriceThb: 110, availableStock: 26 },
      { batchNo: "SME26012", expiryDate: "2028-07-31", sellPriceThb: 115, availableStock: 34 },
    ],
  },
  {
    id: "p-nivea-sun",
    itemName: "Nivea Sun Protect & Moisture SPF50",
    brandName: "Nivea",
    unit: "Tube",
    location: "S2-04",
    shortCode: "ns",
    internalCode: "g+13",
    barcode: "8850001000182",
    categoryShortcut: "s",
    category: "Skincare",
    imageUrl: "https://placehold.co/360x360/png?text=Nivea+Sun",
    weeklySold: 87,
    batches: [
      { batchNo: "NIV25016", expiryDate: "2027-10-31", sellPriceThb: 249, availableStock: 20 },
      { batchNo: "NIV26009", expiryDate: "2028-05-31", sellPriceThb: 249, availableStock: 38 },
    ],
  },
  {
    id: "p-durex",
    itemName: "Durex Fetherlite Condom 3 Pieces",
    brandName: "Durex",
    unit: "Box",
    location: "P1-03",
    shortCode: "dx",
    internalCode: "g+14",
    barcode: "8850001000199",
    categoryShortcut: "p",
    category: "Personal Care",
    imageUrl: "https://placehold.co/360x360/png?text=Durex",
    weeklySold: 102,
    batches: [
      { batchNo: "DRX25058", expiryDate: "2028-12-31", sellPriceThb: 140, availableStock: 44 },
      { batchNo: "DRX26020", expiryDate: "2029-08-31", sellPriceThb: 140, availableStock: 52 },
    ],
  },
  {
    id: "p-dentiste",
    itemName: "Dentiste Plus White Toothpaste 100 g",
    brandName: "Dentiste",
    unit: "Tube",
    location: "O1-01",
    shortCode: "dt",
    internalCode: "g+15",
    barcode: "8850001000205",
    categoryShortcut: "o",
    category: "Oral Care",
    imageUrl: "https://placehold.co/360x360/png?text=Dentiste",
    weeklySold: 91,
    batches: [
      { batchNo: "DEN25024", expiryDate: "2028-02-28", sellPriceThb: 165, availableStock: 31 },
      { batchNo: "DEN26018", expiryDate: "2028-11-30", sellPriceThb: 165, availableStock: 49 },
    ],
  },
];

export const recentSales: RecentSale[] = [
  {
    id: "sale-001",
    billNo: "SL-20260701-0042",
    billDate: "2026-07-01 10:42",
    customerName: "Narin Chaiyaporn",
    pharmacistName: "John Doe",
    paymentMethod: "PromptPay",
    totalQuantity: 5,
    uniqueItems: 3,
    netPayableThb: 143,
    status: "Paid",
  },
  {
    id: "sale-002",
    billNo: "SL-20260701-0041",
    billDate: "2026-07-01 10:18",
    customerName: "Walk-in Customer",
    pharmacistName: "John Doe",
    paymentMethod: "Cash",
    totalQuantity: 2,
    uniqueItems: 2,
    netPayableThb: 315,
    status: "Paid",
  },
  {
    id: "sale-003",
    billNo: "SL-20260701-0040",
    billDate: "2026-07-01 09:55",
    customerName: "Supansa Kittikul",
    pharmacistName: "John Doe",
    paymentMethod: "Credit Card",
    totalQuantity: 4,
    uniqueItems: 2,
    netPayableThb: 755,
    status: "Draft",
  },
  {
    id: "sale-004",
    billNo: "SL-20260630-0118",
    billDate: "2026-06-30 19:12",
    customerName: "Walk-in Customer",
    pharmacistName: "Jane Lee",
    paymentMethod: "Cash",
    totalQuantity: 8,
    uniqueItems: 5,
    netPayableThb: 522,
    status: "Paid",
  },
];
