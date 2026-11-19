import { Directory, File, Paths } from "expo-file-system";

function locate(key: string) {
  const [owner, id] = key.split("/");
  const root = new Directory(Paths.document, "companion-study");
  const directory = id ? new Directory(root, encodeURIComponent(owner)) : root;
  return { directory, name: encodeURIComponent(id ?? owner) + ".json" };
}

export async function read(key: string) {
  const { directory, name } = locate(key);
  const file = new File(directory, name);
  return file.exists ? file.text() : undefined;
}

export async function write(key: string, value: string) {
  const { directory, name } = locate(key);
  directory.create({ intermediates: true, idempotent: true });
  const temporary = new File(directory, name + ".tmp");
  temporary.create({ overwrite: true });
  await temporary.write(value);
  await temporary.move(new File(directory, name), { overwrite: true });
}

export async function remove(key: string) {
  const { directory, name } = locate(key);
  const file = new File(directory, name);
  if (file.exists) await file.delete();
}

export async function removeAccount(owner: string) {
  const { directory } = locate(owner + "/snapshot");
  if (directory.exists) await directory.delete();
}
