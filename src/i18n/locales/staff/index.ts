// The staff console's strings, one module per screen so they can be edited independently.
import * as boss from "./boss";
import * as bookings from "./bookings";
import * as host from "./host";
import * as inbox from "./inbox";
import * as fields from "./fields";
import * as integrations from "./integrations";
import * as inventory from "./inventory";
import * as kitchen from "./kitchen";
import * as members from "./members";
import * as menu from "./menu";
import * as pos from "./pos";
import * as settings from "./settings";
import * as setup from "./setup";
import * as storefront from "./storefront";
import * as shell from "./shell";
import * as tables from "./tables";
import * as team from "./team";

export const staffEn = {
  shell: shell.en,
  boss: boss.en,
  host: host.en,
  pos: pos.en,
  kitchen: kitchen.en,
  bookings: bookings.en,
  menu: menu.en,
  tables: tables.en,
  members: members.en,
  team: team.en,
  settings: settings.en,
  setup: setup.en,
  inbox: inbox.en,
  integrations: integrations.en,
  storefront: storefront.en,
  fields: fields.en,
  inventory: inventory.en,
} as const;

export const staffZh = {
  shell: shell.zh,
  boss: boss.zh,
  host: host.zh,
  pos: pos.zh,
  kitchen: kitchen.zh,
  bookings: bookings.zh,
  menu: menu.zh,
  tables: tables.zh,
  members: members.zh,
  team: team.zh,
  settings: settings.zh,
  setup: setup.zh,
  inbox: inbox.zh,
  integrations: integrations.zh,
  storefront: storefront.zh,
  fields: fields.zh,
  inventory: inventory.zh,
};
