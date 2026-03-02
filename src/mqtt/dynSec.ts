// src/mqtt/dynSec.ts
// Manage MQTT device accounts via Mosquitto Dynamic Security Plugin
// Commands are published to $CONTROL/dynamic-security/v1

import { client } from './client';

const DYNSEC_TOPIC = '$CONTROL/dynamic-security/v1';

function publishDynSecCommand(command: object): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!client || !client.connected) {
      reject(new Error('MQTT client not connected'));
      return;
    }

    client.publish(DYNSEC_TOPIC, JSON.stringify(command), { qos: 1 }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Create a device MQTT client with ACLs scoped to its frame topic.
 * Username = MAC address (colons removed), password = generated token.
 */
export async function createDeviceClient(mac: string, password: string, frameId: number): Promise<void> {
  const username = mac.replace(/:/g, '');

  const commands = {
    commands: [
      {
        command: 'createClient',
        username,
        password,
        roles: [{ rolename: 'device' }],
      },
      // Per-device ACL: publish to frame/{frameId}/request/#
      {
        command: 'addClientRole',
        username,
        rolename: 'device',
      },
      // Add device-specific ACLs
      {
        command: 'createRole',
        rolename: `device-${frameId}`,
        acls: [
          {
            acltype: 'publishClientSend',
            topic: `frame/${frameId}/request/#`,
            allow: true,
          },
          {
            acltype: 'subscribeLiteral',
            topic: `frame/${frameId}/response/#`,
            allow: true,
          },
          {
            acltype: 'subscribeLiteral',
            topic: `frame/${frameId}`,
            allow: true,
          },
          // MAC-based registration topics
          {
            acltype: 'publishClientSend',
            topic: `frame/mac/${mac}/request/register`,
            allow: true,
          },
          {
            acltype: 'subscribeLiteral',
            topic: `frame/mac/${mac}/response/register`,
            allow: true,
          },
        ],
      },
      {
        command: 'addClientRole',
        username,
        rolename: `device-${frameId}`,
      },
    ],
  };

  try {
    await publishDynSecCommand(commands);
    console.log(`[DynSec] Created device client: ${username} for frame ${frameId}`);
  } catch (err) {
    // If the client already exists, try updating password and roles instead
    console.warn(`[DynSec] Create failed (may already exist), trying update: ${username}`);
    await updateDevicePassword(mac, password);
  }
}

/**
 * Update a device's MQTT password.
 */
export async function updateDevicePassword(mac: string, newPassword: string): Promise<void> {
  const username = mac.replace(/:/g, '');

  await publishDynSecCommand({
    commands: [
      {
        command: 'setClientPassword',
        username,
        password: newPassword,
      },
    ],
  });

  console.log(`[DynSec] Updated password for device: ${username}`);
}

/**
 * Delete a device's MQTT client account.
 */
export async function deleteDeviceClient(mac: string): Promise<void> {
  const username = mac.replace(/:/g, '');

  await publishDynSecCommand({
    commands: [
      {
        command: 'deleteClient',
        username,
      },
    ],
  });

  console.log(`[DynSec] Deleted device client: ${username}`);
}
