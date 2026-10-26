import type {
  Cart,
  Conversation,
  Mechanic,
  Message,
  Notification,
  Order,
  Product,
  Review,
  Service,
  ServiceCategory,
  ServiceKind,
  ServiceOrder,
  ServiceOrderItem,
  User,
  Vehicle,
  Workshop,
  WorkshopHours,
} from "@/lib/api/types";
import { productImages, workshopImages } from "@/lib/images";
import { COURIERS, shippingCostFor, totalWeight } from "@/lib/shipping";
import { randomCode, slugify } from "@/lib/utils";

export const DEMO_PASSWORD = "password123";

export interface MockDb {
  version: number;
  users: User[];
  passwords: Record<string, string>;
  workshops: Workshop[];
  vehicles: Vehicle[];
  serviceOrders: ServiceOrder[];
  orders: Order[];
  carts: Cart[];
  conversations: Conversation[];
  messages: Message[];
  notifications: Notification[];
  productReviews: Review[];
}

const now = new Date();

function iso(days: number, hour = 10, minute = 0) {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Timestamp in the past, so seeded activity never lands in the future. */
function ago(minutes: number) {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

function dayKey(days: number) {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const hours: WorkshopHours[] = [
  { dayOfWeek: 0, openTime: "08:00", closeTime: "17:00", isClosed: true },
  { dayOfWeek: 1, openTime: "08:00", closeTime: "18:00", isClosed: false },
  { dayOfWeek: 2, openTime: "08:00", closeTime: "18:00", isClosed: false },
  { dayOfWeek: 3, openTime: "08:00", closeTime: "18:00", isClosed: false },
  { dayOfWeek: 4, openTime: "08:00", closeTime: "18:00", isClosed: false },
  { dayOfWeek: 5, openTime: "08:00", closeTime: "18:00", isClosed: false },
  { dayOfWeek: 6, openTime: "09:00", closeTime: "17:00", isClosed: false },
];

const customers: User[] = [
  {
    id: "user-customer-1",
    email: "rina@indobengkel.test",
    fullName: "Rina Prameswari",
    phone: "+62 812 3456 7890",
    role: "customer",
    locale: "en",
    emailVerified: true,
    status: "active",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    createdAt: iso(-220),
  },
  {
    id: "user-customer-2",
    email: "budi@indobengkel.test",
    fullName: "Budi Santoso",
    phone: "+62 813 2244 5566",
    role: "customer",
    locale: "id",
    emailVerified: true,
    status: "active",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    createdAt: iso(-180),
  },
  {
    id: "user-customer-3",
    email: "siti@indobengkel.test",
    fullName: "Siti Rahmawati",
    phone: "+62 811 9988 7766",
    role: "customer",
    locale: "en",
    emailVerified: true,
    status: "active",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    createdAt: iso(-150),
  },
  {
    id: "user-customer-4",
    email: "dewi@indobengkel.test",
    fullName: "Dewi Lestari",
    phone: "+62 815 1122 3344",
    role: "customer",
    locale: "id",
    emailVerified: true,
    status: "active",
    createdAt: iso(-120),
  },
  {
    id: "user-customer-5",
    email: "agus@indobengkel.test",
    fullName: "Agus Pratama",
    phone: "+62 817 5566 7788",
    role: "customer",
    locale: "en",
    emailVerified: true,
    status: "active",
    createdAt: iso(-90),
  },
  {
    id: "user-customer-6",
    email: "maya@indobengkel.test",
    fullName: "Maya Kusuma",
    phone: "+62 819 2233 4455",
    role: "customer",
    locale: "id",
    emailVerified: true,
    status: "active",
    createdAt: iso(-60),
  },
];

const owner: User = {
  id: "user-owner-1",
  email: "andi@kawahmotor.test",
  fullName: "Pak Andi",
  phone: "+62 812 9000 1000",
  role: "workshop_owner",
  locale: "id",
  emailVerified: true,
  status: "active",
  createdAt: iso(-300),
};

const workshopSeeds = [
  ["Kawah Motor Works", "motor", "Jakarta", "Kemang", -6.2607, 106.8139, 4.8, 126],
  ["Northline Auto Service", "mobil", "Jakarta", "Senopati", -6.236, 106.809, 4.7, 89],
  ["Senopati Motor Lab", "motor", "Jakarta", "Senopati", -6.2297, 106.8153, 4.6, 64],
  ["Sudirman Auto Works", "mobil", "Jakarta", "Sudirman", -6.2088, 106.8211, 4.5, 52],
  ["Kemang Tire & Oil", "mobil", "Jakarta", "Kemang", -6.268, 106.817, 4.4, 41],
  ["Cilandak Motor House", "motor", "Jakarta", "Cilandak", -6.288, 106.799, 4.6, 73],
  ["Kuningan Carriage", "mobil", "Jakarta", "Kuningan", -6.229, 106.829, 4.7, 95],
  ["Tebet Scooter Co.", "motor", "Jakarta", "Tebet", -6.226, 106.858, 4.3, 38],
  ["Braga Motorworks", "motor", "Bandung", "Braga", -6.9175, 107.6098, 4.8, 112],
  ["Dago Auto Care", "mobil", "Bandung", "Dago", -6.885, 107.613, 4.7, 84],
  ["Pasteur Engine Room", "mobil", "Bandung", "Pasteur", -6.893, 107.588, 4.5, 57],
  ["Riau Motor Shop", "motor", "Bandung", "Riau", -6.905, 107.618, 4.4, 49],
  ["Buah Batu Garage", "mobil", "Bandung", "Buah Batu", -6.941, 107.625, 4.6, 68],
  ["Cihampelas Scooter", "motor", "Bandung", "Cihampelas", -6.893, 107.604, 4.3, 36],
  ["Setiabudi Auto", "mobil", "Bandung", "Setiabudi", -6.861, 107.594, 4.7, 91],
  ["Sukajadi Motors", "motor", "Bandung", "Sukajadi", -6.889, 107.591, 4.5, 60],
  ["Darmo Auto Service", "mobil", "Surabaya", "Darmo", -7.291, 112.738, 4.8, 105],
  ["Gubeng Motor Works", "motor", "Surabaya", "Gubeng", -7.265, 112.752, 4.6, 77],
  ["Rungkut Car Care", "mobil", "Surabaya", "Rungkut", -7.327, 112.789, 4.5, 54],
  ["Tunjungan Motor", "motor", "Surabaya", "Tunjungan", -7.257, 112.738, 4.4, 43],
  ["Jemursari Garage", "mobil", "Surabaya", "Jemursari", -7.323, 112.743, 4.6, 66],
  ["Kenjeran Scooter", "motor", "Surabaya", "Kenjeran", -7.239, 112.783, 4.3, 31],
  ["Mayjen Sungkono Auto", "mobil", "Surabaya", "Sungkono", -7.291, 112.705, 4.7, 88],
  ["Airlangga Motors", "motor", "Surabaya", "Airlangga", -7.269, 112.758, 4.5, 59],
] as const;

const mechanicNames = [
  "Rudi Santoso",
  "Bagas Wijaya",
  "Teguh Prasetyo",
  "Arif Hidayat",
  "Dedi Kurniawan",
  "Yusuf Maulana",
  "Rizal Firmansyah",
  "Hendra Gunawan",
];

const customerNames = customers.map((c) => c.fullName);

type ServiceSeed = {
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  category: ServiceCategory;
  kind: ServiceKind;
};

function makeServices(workshopId: string, type: "motor" | "mobil"): Service[] {
  const isMobil = type === "mobil";
  const items: ServiceSeed[] = isMobil
    ? [
        {
          name: "Free inspection & diagnosis",
          description:
            "Not sure what is wrong? Book a free check. We inspect the car and send a quote before any paid work starts.",
          price: 0,
          durationMinutes: 30,
          category: "inspection",
          kind: "labor",
        },
        {
          name: "Engine oil 5W-40 (4L)",
          description: "Shell Helix 5W-40, 4 litres. Price is for the oil only.",
          price: 620_000,
          durationMinutes: 20,
          category: "oil",
          kind: "part",
        },
        {
          name: "Oil filter",
          description: "Genuine oil filter, replaced together with the oil.",
          price: 95_000,
          durationMinutes: 15,
          category: "oil",
          kind: "part",
        },
        {
          name: "Oil & filter change (labor)",
          description: "Drain, replace the filter, refill and check for leaks.",
          price: 60_000,
          durationMinutes: 30,
          category: "oil",
          kind: "labor",
        },
        {
          name: "Air filter",
          description: "Engine air filter element, replaced when clogged.",
          price: 275_000,
          durationMinutes: 15,
          category: "engine",
          kind: "part",
        },
        {
          name: "Spark plug set (4)",
          description: "Iridium plugs, set of four, gap checked.",
          price: 480_000,
          durationMinutes: 40,
          category: "engine",
          kind: "part",
        },
        {
          name: "Front brake pads",
          description: "Ceramic pad set for the front axle, incl. road test.",
          price: 890_000,
          durationMinutes: 60,
          category: "brakes",
          kind: "part",
        },
        {
          name: "Brake fluid flush",
          description: "Fluid flush and bleed on all four corners.",
          price: 150_000,
          durationMinutes: 40,
          category: "brakes",
          kind: "labor",
        },
        {
          name: "Headlight bulb",
          description: "Halogen or LED bulb depending on the housing.",
          price: 350_000,
          durationMinutes: 30,
          category: "electrical",
          kind: "part",
        },
        {
          name: "Headlight fitting (labor)",
          description: "Bumper-off lamp replacement and beam alignment.",
          price: 90_000,
          durationMinutes: 40,
          category: "electrical",
          kind: "labor",
        },
        {
          name: "Battery 12V 45Ah",
          description: "Maintenance-free battery, terminals cleaned and greased.",
          price: 1_250_000,
          durationMinutes: 20,
          category: "electrical",
          kind: "part",
        },
        {
          name: "Wheel alignment",
          description: "Four-wheel alignment and suspension check.",
          price: 350_000,
          durationMinutes: 45,
          category: "tires",
          kind: "labor",
        },
        {
          name: "Wheel balancing",
          description: "Balancing for all four wheels.",
          price: 150_000,
          durationMinutes: 30,
          category: "tires",
          kind: "labor",
        },
        {
          name: 'Wiper blade 24"',
          description: "Bosch AeroTwin pair, fitted.",
          price: 185_000,
          durationMinutes: 15,
          category: "body",
          kind: "part",
        },
        {
          name: "AC service",
          description: "Cabin filter, gas top-up and vent cleaning.",
          price: 450_000,
          durationMinutes: 60,
          category: "other",
          kind: "labor",
        },
      ]
    : [
        {
          name: "Free inspection & diagnosis",
          description:
            "Not sure what is wrong? Book a free check. We inspect the bike and send a quote before any paid work starts.",
          price: 0,
          durationMinutes: 30,
          category: "inspection",
          kind: "labor",
        },
        {
          name: "Engine oil 10W-40 (1L)",
          description: "Yamalube 10W-40, 0.8–1 L depending on the engine.",
          price: 78_000,
          durationMinutes: 15,
          category: "oil",
          kind: "part",
        },
        {
          name: "Oil filter",
          description: "Genuine oil filter, replaced together with the oil.",
          price: 45_000,
          durationMinutes: 10,
          category: "oil",
          kind: "part",
        },
        {
          name: "Oil & filter change (labor)",
          description: "Drain, replace the filter, refill and check for leaks.",
          price: 40_000,
          durationMinutes: 30,
          category: "oil",
          kind: "labor",
        },
        {
          name: "Air filter",
          description: "Paper air filter element, replaced when clogged.",
          price: 65_000,
          durationMinutes: 15,
          category: "engine",
          kind: "part",
        },
        {
          name: "Spark plug",
          description: "Standard spark plug, gap checked before fitting.",
          price: 45_000,
          durationMinutes: 20,
          category: "engine",
          kind: "part",
        },
        {
          name: "CVT belt",
          description: "Belt replacement with roller and housing inspection.",
          price: 245_000,
          durationMinutes: 45,
          category: "engine",
          kind: "part",
        },
        {
          name: "Front brake pads",
          description: "Nissin pad set for the front caliper.",
          price: 165_000,
          durationMinutes: 30,
          category: "brakes",
          kind: "part",
        },
        {
          name: "Brake fluid flush",
          description: "DOT 3/4 fluid flush and bleed.",
          price: 60_000,
          durationMinutes: 30,
          category: "brakes",
          kind: "labor",
        },
        {
          name: "Headlight bulb (LED)",
          description: "LED bulb, H4/H6 socket depending on the model.",
          price: 120_000,
          durationMinutes: 20,
          category: "electrical",
          kind: "part",
        },
        {
          name: "Headlight fitting (labor)",
          description: "Remove the front cowl, fit the lamp and align the beam.",
          price: 35_000,
          durationMinutes: 30,
          category: "electrical",
          kind: "labor",
        },
        {
          name: "Battery GTZ5S",
          description: "Maintenance-free battery, terminals cleaned and greased.",
          price: 320_000,
          durationMinutes: 20,
          category: "electrical",
          kind: "part",
        },
        {
          name: "Tubeless tyre 90/90-14",
          description: "IRC tubeless tyre, fitted and balanced.",
          price: 310_000,
          durationMinutes: 40,
          category: "tires",
          kind: "part",
        },
        {
          name: "Wheel balancing",
          description: "Static balancing for one wheel.",
          price: 25_000,
          durationMinutes: 20,
          category: "tires",
          kind: "labor",
        },
        {
          name: "Chain & sprocket set",
          description: "Chain and both sprockets, adjusted and lubricated.",
          price: 385_000,
          durationMinutes: 60,
          category: "other",
          kind: "part",
        },
        {
          name: "Mirror set",
          description: "Left and right mirrors, fitted.",
          price: 95_000,
          durationMinutes: 10,
          category: "body",
          kind: "part",
        },
      ];

  return items.map((item, index) => ({
    id: `svc-${workshopId}-${index + 1}`,
    workshopId,
    ...item,
    isActive: true,
  }));
}

function makeMechanics(workshopId: string, index: number): Mechanic[] {
  return [0, 1, 2].map((offset) => ({
    id: `mech-${workshopId}-${offset + 1}`,
    workshopId,
    name: mechanicNames[(index + offset) % mechanicNames.length],
    phone: `+62 812 70${index}${offset} 4${offset}21`,
    experienceYears: 4 + ((index + offset) % 14),
    skills:
      offset === 0
        ? ["general", "engine"]
        : offset === 1
          ? ["general", "electrical", "tire"]
          : ["general", "body", "transmission"],
    isActive: true,
  }));
}

function makeProducts(
  workshopId: string,
  workshopSlug: string,
  workshopName: string,
  type: "motor" | "mobil",
  index: number,
): Product[] {
  const isMobil = type === "mobil";
  const base = [
    {
      title: isMobil ? "Helix Ultra 5W-40 4L" : "Nmax 1L 10W-40",
      category: "oil" as const,
      brand: isMobil ? "Shell" : "Yamalube",
      partNumber: isMobil ? "SH-5W40-4L" : "YM-10W40-1L",
      price: isMobil ? 620_000 : 78_000,
      discountType: "percent" as const,
      discountValue: isMobil ? 10 : 18,
      weightGrams: isMobil ? 3_800 : 1_000,
      stock: 18,
      imageUrl: productImages[0],
    },
    {
      title: isMobil ? "AeroTwin wiper 24-inch" : "Vario CVT belt",
      category: "sparepart" as const,
      brand: isMobil ? "Bosch" : "Honda",
      partNumber: isMobil ? "BW-24" : "HV-CVT-01",
      price: isMobil ? 185_000 : 245_000,
      discountType: "none" as const,
      discountValue: 0,
      weightGrams: 900,
      stock: 11,
      imageUrl: productImages[1],
    },
    {
      title: isMobil ? "Ceramic brake pads" : "Nmax brake pads",
      category: "sparepart" as const,
      brand: isMobil ? "Brembo" : "Nissin",
      partNumber: isMobil ? "BR-CER-01" : "NS-NMAX-02",
      price: isMobil ? 890_000 : 165_000,
      discountType: "fixed" as const,
      discountValue: isMobil ? 90_000 : 20_000,
      weightGrams: 1_600,
      stock: 7,
      imageUrl: productImages[2],
    },
    {
      title: isMobil ? "Engine air filter" : "Air filter element",
      category: "sparepart" as const,
      brand: "Denso",
      partNumber: `DN-${index}-AF`,
      price: isMobil ? 275_000 : 65_000,
      discountType: "none" as const,
      discountValue: 0,
      weightGrams: 400,
      stock: 24,
      imageUrl: productImages[3],
    },
    {
      title: isMobil ? "All-weather floor mats" : "Tubeless tire 90/90-14",
      category: isMobil ? ("accessories" as const) : ("sparepart" as const),
      brand: isMobil ? "3M" : "IRC",
      partNumber: isMobil ? "3M-MAT-01" : "IRC-9090-14",
      price: isMobil ? 450_000 : 310_000,
      discountType: "percent" as const,
      discountValue: 8,
      weightGrams: isMobil ? 2_500 : 2_900,
      stock: 5,
      imageUrl: productImages[4],
    },
  ];
  return base.map((item, productIndex) => {
    const finalPrice =
      item.discountType === "percent"
        ? Math.round(item.price * (1 - item.discountValue / 100))
        : item.discountType === "fixed"
          ? Math.max(0, item.price - item.discountValue)
          : item.price;
    return {
      id: `prod-${workshopId}-${productIndex + 1}`,
      workshopId,
      workshopSlug,
      workshopName,
      workshopType: type,
      slug: slugify(`${item.title}-${workshopId}-${productIndex + 1}`),
      description:
        "Workshop-tested part with a 14-day fitment guarantee. Pickup only at the workshop counter.",
      ...item,
      finalPrice,
      isActive: true,
      ratingAvg: 4.2 + ((index + productIndex) % 7) / 10,
      ratingCount: 8 + ((index * 5 + productIndex * 3) % 40),
    };
  });
}

const reviewComments = [
  "Booked a slot at 9 and the bike was ready before lunch. Clear estimate, no surprise charges.",
  "The mechanic explained what was actually needed and what could wait. Honest work.",
  "Clean waiting area, fast WhatsApp updates, and the invoice matched the estimate exactly.",
  "They found a small leak during the inspection and showed me the photo before fixing it.",
  "Dropped in for an oil change, stayed for the coffee. The service desk was very organized.",
  "Good work, though the workshop was busy and pickup took a little longer than promised.",
];

const reviewTags: Review["tags"][] = [
  ["fair_price", "honest"],
  ["fast", "friendly"],
  ["clean", "fair_price"],
  ["honest"],
  ["fast", "clean", "friendly"],
  ["fair_price"],
];

function makeReviews(workshopId: string, index: number, count: number): Review[] {
  return Array.from({ length: count }).map((_, reviewIndex) => {
    const rating = reviewIndex === 2 ? 4 : 5;
    return {
      id: `rev-${workshopId}-${reviewIndex + 1}`,
      customerId: customers[(index + reviewIndex) % customers.length].id,
      customerName: customerNames[(index + reviewIndex) % customers.length],
      workshopId,
      rating,
      comment: reviewComments[(index + reviewIndex) % reviewComments.length],
      tags: reviewTags[(index + reviewIndex) % reviewTags.length],
      status: "published",
      workshopReply:
        reviewIndex === 0 && index % 3 === 0
          ? "Thanks for trusting us with the vehicle. See you at the next service."
          : undefined,
      repliedAt:
        reviewIndex === 0 && index % 3 === 0
          ? iso(-2 - index, 16, 30)
          : undefined,
      createdAt: iso(-4 - index - reviewIndex * 2, 11, 0),
    };
  });
}

function buildWorkshops(): Workshop[] {
  return workshopSeeds.map((seed, index) => {
    const [name, type, city, area, lat, lng, ratingAvg, ratingCount] = seed;
    const id = `ws-${String(index + 1).padStart(2, "0")}`;
    const slug = slugify(name);
    const services = makeServices(id, type);
    const mechanics = makeMechanics(id, index);
    const products = makeProducts(id, slug, name, type, index);
    const reviews = makeReviews(id, index, 3);
    const cover = workshopImages[index % workshopImages.length];
    return {
      id,
      ownerUserId: index === 0 ? owner.id : `user-owner-${index + 1}`,
      name,
      slug,
      description:
        type === "motor"
          ? "A neighbourhood motorcycle workshop focused on honest diagnostics, routine service and parts that fit. Walk-ins welcome, bookings preferred."
          : "A modern car service centre for routine maintenance, brakes, tyres and diagnostics. Transparent estimates, photo updates and pickup at the counter.",
      workshopType: type,
      phone: `+62 812 8${String(index).padStart(3, "0")} 2211`,
      email: `hello@${slug.replace(/-/g, "")}.test`,
      addressLine: `Jl. ${area} Raya No. ${12 + index}, ${city}`,
      city,
      province:
        city === "Jakarta"
          ? "DKI Jakarta"
          : city === "Bandung"
            ? "Jawa Barat"
            : "Jawa Timur",
      postalCode: city === "Jakarta" ? "12730" : city === "Bandung" ? "40115" : "60241",
      countryCode: "ID",
      lat,
      lng,
      timezone: "Asia/Jakarta",
      coverUrl: cover,
      logoUrl: undefined,
      gallery: [cover, workshopImages[(index + 1) % workshopImages.length]],
      status: index === 23 ? "draft" : "active",
      ratingAvg,
      ratingCount,
      hours,
      closures: index % 7 === 0 ? [{ id: `closure-${id}`, date: dayKey(5), reason: "Stock take" }] : [],
      slotCapacityPerHour: 1,
      services,
      mechanics,
      products,
      reviews,
      createdAt: iso(-120 - index),
    };
  });
}

function buildVehicles(): Vehicle[] {
  return [
    {
      id: "veh-1",
      customerId: customers[0].id,
      type: "motor",
      brand: "Honda",
      model: "Vario 160",
      year: 2022,
      plateNumber: "B 428 KPZ",
      color: "Matte black",
      odometerKm: 24_180,
      reminderMonths: 6,
      reminderKm: 5_000,
      lastServiceAt: iso(-10),
      lastWorkshopName: "Kawah Motor Works",
      photoUrl: workshopImages[3],
    },
    {
      id: "veh-2",
      customerId: customers[0].id,
      type: "mobil",
      brand: "Toyota",
      model: "Raize",
      year: 2023,
      plateNumber: "B 9021 RIN",
      color: "Pearl white",
      odometerKm: 11_420,
      reminderMonths: 6,
      reminderKm: 5_000,
      lastServiceAt: iso(-45),
      lastWorkshopName: "Northline Auto Service",
      photoUrl: workshopImages[2],
    },
    {
      id: "veh-3",
      customerId: customers[1].id,
      type: "motor",
      brand: "Yamaha",
      model: "NMAX 155",
      year: 2021,
      plateNumber: "B 712 BDS",
      color: "Grey",
      odometerKm: 38_900,
      reminderMonths: 6,
      reminderKm: 5_000,
      lastServiceAt: iso(-60),
      lastWorkshopName: "Kawah Motor Works",
      photoUrl: workshopImages[3],
    },
    {
      id: "veh-4",
      customerId: customers[2].id,
      type: "mobil",
      brand: "Honda",
      model: "HR-V",
      year: 2020,
      plateNumber: "B 1501 STI",
      color: "Silver",
      odometerKm: 52_300,
      reminderMonths: 6,
      reminderKm: 5_000,
      lastServiceAt: iso(-80),
      lastWorkshopName: "Northline Auto Service",
      photoUrl: workshopImages[2],
    },
    {
      id: "veh-5",
      customerId: customers[3].id,
      type: "motor",
      brand: "Honda",
      model: "PCX 160",
      year: 2022,
      plateNumber: "D 3301 DWI",
      color: "White",
      odometerKm: 19_750,
      reminderMonths: 6,
      reminderKm: 5_000,
      lastServiceAt: iso(-30),
      lastWorkshopName: "Braga Motorworks",
      photoUrl: workshopImages[3],
    },
    {
      id: "veh-6",
      customerId: customers[4].id,
      type: "mobil",
      brand: "Mitsubishi",
      model: "Xpander",
      year: 2021,
      plateNumber: "L 8801 AGS",
      color: "Black",
      odometerKm: 44_100,
      reminderMonths: 6,
      reminderKm: 5_000,
      lastServiceAt: iso(-55),
      lastWorkshopName: "Darmo Auto Service",
      photoUrl: workshopImages[2],
    },
    {
      id: "veh-7",
      customerId: customers[5].id,
      type: "motor",
      brand: "Yamaha",
      model: "Aerox 155",
      year: 2023,
      plateNumber: "L 2210 MYA",
      color: "Blue",
      odometerKm: 8_600,
      reminderMonths: 6,
      reminderKm: 5_000,
      lastServiceAt: iso(-12),
      lastWorkshopName: "Gubeng Motor Works",
      photoUrl: workshopImages[3],
    },
  ];
}

function buildServiceOrders(workshops: Workshop[], vehicles: Vehicle[]): ServiceOrder[] {
  const statuses: ServiceOrder["status"][] = [
    "paid",
    "completed",
    "in_progress",
    "confirmed",
    "requested",
    "paid",
    "cancelled",
    "awaiting_approval",
  ];
  const orders: ServiceOrder[] = [];
  for (let i = 0; i < 40; i += 1) {
    const workshop = i < 5 ? workshops[0] : workshops[i % workshops.length];
    const matching = vehicles.filter((v) => v.type === workshop.workshopType);
    const vehicle = matching[i % matching.length];
    const customer = customers.find((c) => c.id === vehicle.customerId)!;
    const kawahStatuses: ServiceOrder["status"][] = [
      "paid",
      "confirmed",
      "in_progress",
      "awaiting_approval",
      "requested",
    ];
    const status =
      workshop.id === "ws-01" && i < 5
        ? kawahStatuses[i]
        : statuses[i % statuses.length];
    const paidServices = workshop.services.filter((service) => service.price > 0);
    const serviceA = paidServices[i % paidServices.length];
    const serviceB = paidServices[(i + 1) % paidServices.length];
    const estimatedTotal = serviceA.price + (i % 3 === 0 ? serviceB.price : 0);
    const finalTotal =
      status === "completed" || status === "paid" || status === "awaiting_approval"
        ? status === "awaiting_approval"
          ? Math.round(estimatedTotal * 1.62)
          : estimatedTotal + (i % 2 === 0 ? 45_000 : 0)
        : undefined;
    const future = ["requested", "confirmed", "in_progress"].includes(status);
    const scheduledAt = future ? iso(1 + (i % 6), 9 + (i % 7), i % 2 === 0 ? 0 : 30) : iso(-(i + 1), 9 + (i % 7), 0);
    const items =
      finalTotal === undefined
        ? []
        : [
            {
              id: `soi-${i}-1`,
              kind: serviceA.kind,
              name: serviceA.name,
              qty: 1,
              unitPrice: serviceA.price,
              subtotal: serviceA.price,
            },
            ...(i % 3 === 0
              ? [
                  {
                    id: `soi-${i}-2`,
                    kind: serviceB.kind,
                    name: serviceB.name,
                    qty: 1,
                    unitPrice: serviceB.price,
                    subtotal: serviceB.price,
                  },
                ]
              : []),
            ...(i % 4 === 0
              ? [
                  {
                    id: `soi-${i}-3`,
                    kind: "part" as const,
                    productId: workshop.products[0].id,
                    name: workshop.products[0].title,
                    qty: 1,
                    unitPrice: workshop.products[0].finalPrice,
                    subtotal: workshop.products[0].finalPrice,
                  },
                ]
              : []),
          ];
    const mechanic = workshop.mechanics[i % workshop.mechanics.length];
    orders.push({
      id: `so-${String(i + 1).padStart(3, "0")}`,
      code: `SO-${String(8100 + i)}`,
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      workshopId: workshop.id,
      workshopName: workshop.name,
      workshopSlug: workshop.slug,
      workshopType: workshop.workshopType,
      vehicleId: vehicle.id,
      vehicleLabel: `${vehicle.brand} ${vehicle.model}`,
      plateNumber: vehicle.plateNumber,
      status,
      scheduledAt,
      complaint:
        i % 3 === 0
          ? "There is a light vibration at low speed and the last oil change was a while ago."
          : "Routine service before a long drive. Please check the brakes and fluids.",
      customerNote: i % 4 === 0 ? "Please send a photo update before replacing any part." : undefined,
      odometerIn: vehicle.odometerKm - 120 + i * 3,
      odometerOut:
        status === "completed" || status === "paid"
          ? vehicle.odometerKm + 20 + i
          : status === "in_progress" || status === "awaiting_approval"
            ? vehicle.odometerKm + 8 + i
            : undefined,
      estimatedTotal,
      finalTotal,
      mechanicNote:
        finalTotal !== undefined
          ? "Replaced the requested items and completed a road test. Brake fluid level is healthy."
          : undefined,
      mechanicIds: finalTotal !== undefined ? [mechanic.id] : [],
      mechanicNames: finalTotal !== undefined ? [mechanic.name] : [],
      items,
      photos: finalTotal !== undefined ? [workshop.coverUrl] : [],
      createdAt: iso(-(i + 2), 8, 30),
      startedAt: ["in_progress", "awaiting_approval", "completed", "paid"].includes(status)
        ? iso(-(i + 1), 10, 0)
        : undefined,
      completedAt: ["completed", "paid", "awaiting_approval"].includes(status)
        ? iso(-(i + 1), 14, 0)
        : undefined,
      paidAt: status === "paid" ? iso(-(i + 1), 15, 0) : undefined,
      paymentMethod: status === "paid" ? (i % 2 === 0 ? "qris" : "cash") : undefined,
      cancelReason: status === "cancelled" ? "Customer found a closer slot." : undefined,
    });
  }
  return orders;
}

function buildOrders(workshops: Workshop[]): Order[] {
  const statuses: Order["status"][] = [
    "pending_payment",
    "paid",
    "preparing",
    "ready_for_pickup",
    "completed",
    "cancelled",
    "expired",
    "completed",
    "paid",
    "preparing",
    "ready_for_pickup",
    "shipped",
  ];
  return statuses.map((status, index) => {
    const workshop = index < 4 ? workshops[0] : workshops[(index + 1) % workshops.length];
    const customer = customers[index % customers.length];
    const productA = workshop.products[index % workshop.products.length];
    const productB = workshop.products[(index + 2) % workshop.products.length];
    const items = [
      {
        id: `oi-${index}-1`,
        productId: productA.id,
        titleSnapshot: productA.title,
        unitPrice: productA.finalPrice,
        qty: 1,
        subtotal: productA.finalPrice,
        weightGrams: productA.weightGrams,
        imageUrl: productA.imageUrl,
        reviewed: status === "completed" && index % 2 === 0,
      },
      ...(index % 3 === 0
        ? [
            {
              id: `oi-${index}-2`,
              productId: productB.id,
              titleSnapshot: productB.title,
              unitPrice: productB.finalPrice,
              qty: 1,
              subtotal: productB.finalPrice,
              weightGrams: productB.weightGrams,
              imageUrl: productB.imageUrl,
              reviewed: false,
            },
          ]
        : []),
    ];
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const fulfillment: Order["fulfillment"] = index % 3 === 0 ? "expedition" : "pickup";
    const courier = COURIERS[index % COURIERS.length];
    const shippingCost =
      fulfillment === "expedition" ? shippingCostFor(courier.id, totalWeight(items)) : 0;
    const total = subtotal + shippingCost;
    const pickupCode = randomCode("", 6).replace("-", "").slice(0, 6);
    return {
      id: `ord-${String(index + 1).padStart(3, "0")}`,
      code: `ORD-${String(5100 + index)}`,
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      workshopId: workshop.id,
      workshopName: workshop.name,
      workshopSlug: workshop.slug,
      status,
      fulfillment,
      shippingCost,
      shipping:
        fulfillment === "expedition"
          ? {
              courier: courier.id,
              service: courier.service,
              cost: shippingCost,
              address: {
                recipient: customer.fullName,
                phone: customer.phone,
                line: "Jl. Kemang Selatan VIII No. 12",
                city: workshop.city,
                postalCode: "12730",
              },
              trackingNumber:
                status === "shipped" ? `${courier.id.toUpperCase()}${51120000 + index}` : undefined,
              shippedAt: status === "shipped" ? iso(-index, 15, 0) : undefined,
            }
          : undefined,
      items,
      subtotal,
      discountTotal: 0,
      total,
      pickupCode,
      expiresAt: iso(0, 23, 59),
      createdAt: iso(-(index + 1), 12, 0),
      paidAt: ["paid", "preparing", "ready_for_pickup", "shipped", "completed"].includes(status)
        ? iso(-(index + 1), 12, 30)
        : undefined,
      preparingAt: ["preparing", "ready_for_pickup", "shipped", "completed"].includes(status)
        ? iso(-(index + 1), 13, 0)
        : undefined,
      readyAt: ["ready_for_pickup", "shipped", "completed"].includes(status)
        ? iso(-(index + 1), 14, 0)
        : undefined,
      completedAt: status === "completed" ? iso(-index, 10, 0) : undefined,
      payment: {
        id: `pay-${index + 1}`,
        orderId: `ord-${String(index + 1).padStart(3, "0")}`,
        provider: "fake",
        method: index % 3 === 0 ? "va" : index % 3 === 1 ? "qris" : "bank_transfer",
        amount: total,
        status:
          status === "pending_payment"
            ? "pending"
            : status === "expired"
              ? "expired"
              : "paid",
        providerRef: `FAKE-${5000 + index}`,
        vaNumber: index % 3 === 0 ? `8808 1234 5678 ${9000 + index}` : undefined,
        qrString: index % 3 === 1 ? `00020101021226${index}5802ID` : undefined,
        expiresAt: iso(0, 23, 59),
        paidAt: status === "pending_payment" ? undefined : iso(-(index + 1), 12, 30),
      },
    };
  });
}

function buildConversations(workshops: Workshop[]): {
  conversations: Conversation[];
  messages: Message[];
} {
  const kawah = workshops[0];
  const northline = workshops[1];
  const conversations: Conversation[] = [
    {
      id: "conv-1",
      customerId: customers[0].id,
      customerName: customers[0].fullName,
      workshopId: kawah.id,
      workshopName: kawah.name,
      workshopSlug: kawah.slug,
      lastMessageAt: ago(30),
      unreadCount: 1,
    },
    {
      id: "conv-2",
      customerId: customers[0].id,
      customerName: customers[0].fullName,
      workshopId: northline.id,
      workshopName: northline.name,
      workshopSlug: northline.slug,
      lastMessageAt: iso(-1, 16, 12),
      unreadCount: 0,
    },
    {
      id: "conv-3",
      customerId: customers[1].id,
      customerName: customers[1].fullName,
      workshopId: kawah.id,
      workshopName: kawah.name,
      workshopSlug: kawah.slug,
      lastMessageAt: ago(150),
      unreadCount: 2,
    },
  ];
  const messages: Message[] = [
    {
      id: "msg-1",
      conversationId: "conv-1",
      senderUserId: customers[0].id,
      senderName: customers[0].fullName,
      senderRole: "customer",
      body: "Hi, is the 15:30 slot still open for a Vario 160 tune-up?",
      readAt: ago(43),
      createdAt: ago(45),
    },
    {
      id: "msg-2",
      conversationId: "conv-1",
      senderUserId: owner.id,
      senderName: owner.fullName,
      senderRole: "workshop_owner",
      body: "Yes, we have one bay left. Bring the bike 10 minutes early and we can start on time.",
      createdAt: ago(30),
    },
    {
      id: "msg-3",
      conversationId: "conv-2",
      senderUserId: owner.id,
      senderName: owner.fullName,
      senderRole: "workshop_owner",
      body: "The brake pads for your Raize are ready for pickup.",
      createdAt: iso(-1, 16, 12),
    },
    {
      id: "msg-4",
      conversationId: "conv-3",
      senderUserId: customers[1].id,
      senderName: customers[1].fullName,
      senderRole: "customer",
      body: "Can you check the CVT belt as well? It feels a little jerky.",
      createdAt: ago(150),
    },
  ];
  return { conversations, messages };
}

function buildNotifications(): Notification[] {
  return [
    {
      id: "notif-1",
      userId: customers[0].id,
      type: "booking_confirmed",
      title: "Booking confirmed",
      body: "Kawah Motor Works confirmed your Vario 160 booking for tomorrow at 15:30.",
      href: "/bookings/so-001",
      createdAt: ago(60),
    },
    {
      id: "notif-2",
      userId: customers[0].id,
      type: "order_ready",
      title: "Order ready for pickup",
      body: "Your order at Kawah Motor Works is ready. Show your pickup code at the counter.",
      href: "/orders/ord-001",
      createdAt: ago(120),
    },
    {
      id: "notif-3",
      userId: customers[0].id,
      type: "estimate_approval",
      title: "Estimate needs approval",
      body: "The final invoice for your service is above the approved estimate.",
      href: "/bookings/so-002",
      createdAt: iso(-1, 15, 20),
    },
    {
      id: "notif-4",
      userId: customers[0].id,
      type: "chat_message",
      title: "New message from Kawah Motor Works",
      body: "Yes, we have one bay left. Bring the bike 10 minutes early.",
      href: "/chat/conv-1",
      createdAt: ago(30),
    },
    {
      id: "notif-5",
      userId: customers[0].id,
      type: "service_reminder",
      title: "Service reminder",
      body: "Your Vario 160 is due for a 5,000 km check.",
      href: "/vehicles/veh-1",
      createdAt: iso(-2, 9, 0),
    },
    {
      id: "notif-6",
      userId: owner.id,
      type: "booking_requested",
      title: "New booking request",
      body: "Rina Prameswari requested a slot for a Vario 160.",
      href: "/workshop/bookings",
      createdAt: ago(180),
    },
    {
      id: "notif-7",
      userId: owner.id,
      type: "order_paid",
      title: "Order paid",
      body: "A pickup order has been paid and is ready to prepare.",
      href: "/workshop/orders",
      createdAt: ago(240),
    },
    {
      id: "notif-8",
      userId: owner.id,
      type: "review_reply",
      title: "New review",
      body: "A customer left a 5-star review for Kawah Motor Works.",
      href: "/workshop/reviews",
      createdAt: iso(-1, 17, 0),
    },
    {
      id: "notif-9",
      userId: owner.id,
      type: "review_reply",
      title: "Pickup order completed",
      body: "A customer picked up an order at Kawah Motor Works.",
      href: "/workshop/orders",
      createdAt: iso(-1, 11, 0),
    },
  ];
}

function buildProductReviews(workshops: Workshop[]): Review[] {
  return Array.from({ length: 12 }).map((_, index) => {
    const workshop = workshops[index % workshops.length];
    const product = workshop.products[index % workshop.products.length];
    return {
      id: `prev-${index + 1}`,
      customerId: customers[index % customers.length].id,
      customerName: customerNames[index % customerNames.length],
      workshopId: workshop.id,
      orderId: `ord-${String((index % 10) + 1).padStart(3, "0")}`,
      productId: product.id,
      rating: index % 5 === 0 ? 4 : 5,
      comment:
        index % 2 === 0
          ? "Fits perfectly and the counter staff helped me check the part number."
          : "Good price, genuine packaging, and pickup was quick.",
      tags: ["fair_price", "fast"],
      status: index === 11 ? "hidden" : "published",
      createdAt: iso(-index - 1, 10, 0),
    };
  });
}

export function createSeedDb(): MockDb {
  const workshops = buildWorkshops();
  const vehicles = buildVehicles();
  const serviceOrders = buildServiceOrders(workshops, vehicles);
  const orders = buildOrders(workshops);
  const { conversations, messages } = buildConversations(workshops);
  const notifications = buildNotifications();
  const productReviews = buildProductReviews(workshops);

  const passwords: Record<string, string> = {
    [customers[0].email]: DEMO_PASSWORD,
    [customers[1].email]: DEMO_PASSWORD,
    [customers[2].email]: DEMO_PASSWORD,
    [customers[3].email]: DEMO_PASSWORD,
    [customers[4].email]: DEMO_PASSWORD,
    [customers[5].email]: DEMO_PASSWORD,
    [owner.email]: DEMO_PASSWORD,
  };

  return {
    version: 5,
    users: [...customers, owner],
    passwords,
    workshops,
    vehicles,
    serviceOrders,
    orders,
    carts: [],
    conversations,
    messages,
    notifications,
    productReviews,
  };
}
