import { INestApplication } from "@nestjs/common";
import {
  API,
  Agent,
  createApp,
  registerCustomer,
  registerWorkshop,
  WorkshopFixture,
} from "./helpers";

describe("Chat and notifications", () => {
  let app: INestApplication;
  let workshop: WorkshopFixture;
  let customer: Agent;

  beforeAll(async () => {
    app = await createApp();
    workshop = await registerWorkshop(app);
    const registered = await registerCustomer(app);
    customer = registered.agent;
  });

  afterAll(async () => {
    await app.close();
  });

  it("starts a conversation once per customer and workshop pair", async () => {
    const first = await customer
      .post(`${API}/conversations`)
      .send({ workshopId: workshop.workshop.id })
      .expect(201);
    expect(first.body.data).toMatchObject({
      workshopId: workshop.workshop.id,
      workshopName: workshop.workshop.name,
    });

    const second = await customer
      .post(`${API}/conversations`)
      .send({ workshopId: workshop.workshop.id })
      .expect(201);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it("validates message bodies and delivers them to both sides", async () => {
    const conversation = await customer
      .post(`${API}/conversations`)
      .send({ workshopId: workshop.workshop.id })
      .expect(201);
    const conversationId = conversation.body.data.id;

    const empty = await customer
      .post(`${API}/conversations/${conversationId}/messages`)
      .send({ body: "   " })
      .expect(422);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");

    const tooLong = await customer
      .post(`${API}/conversations/${conversationId}/messages`)
      .send({ body: "x".repeat(2001) })
      .expect(422);
    expect(tooLong.body.error.code).toBe("VALIDATION_ERROR");

    const sent = await customer
      .post(`${API}/conversations/${conversationId}/messages`)
      .send({ body: "  Halo, apakah bisa servis besok pagi?  " })
      .expect(201);
    expect(sent.body.data.body).toBe("Halo, apakah bisa servis besok pagi?");

    const customerView = await customer
      .get(`${API}/conversations/${conversationId}`)
      .expect(200);
    expect(customerView.body.data.messages).toHaveLength(1);

    const ownerInbox = await workshop.agent
      .get(`${API}/conversations?scope=workshop`)
      .expect(200);
    const entry = ownerInbox.body.data.find((item: any) => item.id === conversationId);
    expect(entry).toBeDefined();
    expect(entry.unreadCount).toBe(1);
    expect(entry.lastMessage).toBe("Halo, apakah bisa servis besok pagi?");

    const reply = await workshop.agent
      .post(`${API}/conversations/${conversationId}/messages`)
      .send({ body: "Bisa, slot jam 09:00 masih kosong." })
      .expect(201);
    expect(reply.body.data.senderRole).toBe("workshop_owner");

    await customer
      .post(`${API}/conversations/${conversationId}/read`)
      .expect(201);

    const afterRead = await customer
      .get(`${API}/conversations/${conversationId}`)
      .expect(200);
    expect(afterRead.body.data.messages).toHaveLength(2);
    const ownerMessage = afterRead.body.data.messages.find(
      (message: any) => message.senderRole === "workshop_owner",
    );
    expect(ownerMessage.readAt).toBeTruthy();

    const notifications = await workshop.agent.get(`${API}/notifications`).expect(200);
    expect(
      notifications.body.data.some((notification: any) => notification.type === "chat_message"),
    ).toBe(true);
  });

  it("hides a conversation from other customers and other workshops", async () => {
    const conversation = await customer
      .post(`${API}/conversations`)
      .send({ workshopId: workshop.workshop.id })
      .expect(201);
    const conversationId = conversation.body.data.id;

    const stranger = await registerCustomer(app);
    const asStranger = await stranger.agent
      .get(`${API}/conversations/${conversationId}`)
      .expect(404);
    expect(asStranger.body.error.code).toBe("NOT_FOUND");

    const otherWorkshop = await registerWorkshop(app);
    const asOtherOwner = await otherWorkshop.agent
      .get(`${API}/conversations/${conversationId}`)
      .expect(404);
    expect(asOtherOwner.body.error.code).toBe("NOT_FOUND");

    const readAttempt = await otherWorkshop.agent
      .post(`${API}/conversations/${conversationId}/read`)
      .expect(404);
    expect(readAttempt.body.error.code).toBe("NOT_FOUND");
  });

  it("lists and reads notifications for the signed-in user only", async () => {
    const registered = await registerCustomer(app);
    const notifications = await registered.agent.get(`${API}/notifications`).expect(200);
    expect(Array.isArray(notifications.body.data)).toBe(true);

    const markAll = await registered.agent
      .post(`${API}/notifications/read-all`)
      .expect(201);
    expect(markAll.body.data.ok).toBe(true);
  });
});
