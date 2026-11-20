jest.mock("@messagebird/sdk", () => {
  const send = jest.fn();
  const sendEmail = jest.fn();
  const BirdClientMock = jest.fn().mockImplementation(() => ({
    sms: { send },
    email: { send: sendEmail },
  }));
  return { __esModule: true, BirdClient: BirdClientMock };
});

import { BirdClient } from "@messagebird/sdk";
import { getBirdClient, sendBirdSms, sendBirdEmail } from "@/lib/bird";

const mockedBirdClient = BirdClient as unknown as jest.Mock;

describe("bird", () => {
  beforeEach(() => {
    process.env.BIRD_API_KEY = "bk_test_key";
    mockedBirdClient.mockClear();
  });

  it("returns failed when BIRD_API_KEY is not set", async () => {
    delete process.env.BIRD_API_KEY;
    const res = await sendBirdSms({ to: "+15550001111", from: "+15557654321", text: "Missed call" });
    expect(res).toEqual({ status: "failed", error: "BIRD_API_KEY_NOT_SET" });
  });

  it("sends sms via bird client", async () => {
    const client = getBirdClient();
    expect(client).not.toBeNull();
    (client!.sms.send as jest.Mock).mockResolvedValue({ id: "sms_123", status: "accepted" });
    const res = await sendBirdSms({ to: "+15550001111", from: "+15557654321", text: "Missed call", category: "transactional" });
    expect((client!.sms.send as jest.Mock).mock.calls[0][0]).toMatchObject({
      to: "+15550001111",
      from: "+15557654321",
      text: "Missed call",
      category: "transactional",
    });
    expect(res).toEqual({ status: "accepted", providerId: "sms_123", error: undefined });
  });

  it("returns failed when bird send throws", async () => {
    const client = getBirdClient();
    (client!.sms.send as jest.Mock).mockRejectedValue(new Error("boom"));
    const res = await sendBirdSms({ to: "+15550001111", from: "+15557654321", text: "Missed call" });
    expect(res.status).toBe("failed");
    expect(res.error).toBe("boom");
  });

  it("sends email via bird client", async () => {
    const client = getBirdClient();
    (client!.email.send as jest.Mock).mockResolvedValue({ id: "em_123", status: "processed" });
    const res = await sendBirdEmail({ from: { email: "onboarding@messagebird.dev", name: "Bird" }, to: ["modelfelixperez@gmail.com"], subject: "Hello World", html: "<p>hi</p>" });
    expect((client!.email.send as jest.Mock).mock.calls[0][0]).toMatchObject({ subject: "Hello World" });
    expect(res).toEqual({ status: "processed", providerId: "em_123", error: undefined });
  });
});
