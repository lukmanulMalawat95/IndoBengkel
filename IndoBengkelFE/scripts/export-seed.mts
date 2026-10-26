import { createSeedDb } from "../src/lib/api/mock/data";
import { writeFileSync } from "node:fs";
const db = createSeedDb();
writeFileSync("../IndoBengkelDB/seed-export.json", JSON.stringify(db, null, 2));
console.log(JSON.stringify({ users: db.users.length, workshops: db.workshops.length, services: db.workshops.reduce((n,w)=>n+w.services.length,0), mechanics: db.workshops.reduce((n,w)=>n+w.mechanics.length,0), products: db.workshops.reduce((n,w)=>n+w.products.length,0), reviews: db.workshops.reduce((n,w)=>n+w.reviews.length,0), serviceOrders: db.serviceOrders.length, orders: db.orders.length, conversations: db.conversations.length, messages: db.messages.length, notifications: db.notifications.length, productReviews: db.productReviews.length }));
