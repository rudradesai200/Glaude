import { Client, GatewayIntentBits } from "discord.js";

export const createClient = (): Client => {
  return new Client({
    intents: [GatewayIntentBits.Guilds],
  });
};
