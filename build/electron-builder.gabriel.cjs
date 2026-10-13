const fs = require("node:fs");
const path = require("node:path");
const JSON5 = require("json5");

const original = JSON5.parse(
	fs.readFileSync(path.join(__dirname, "..", "electron-builder.json5"), "utf8"),
);

module.exports = {
	...original,
	productName: "recordly-gabriel",
	appId: "dev.recordly.gabriel",
	extraMetadata: { name: "recordly-gabriel", productName: "recordly-gabriel" },
	directories: { ...original.directories, output: "release/gabriel" },
	mac: { ...original.mac, identity: "-", notarize: false },
	publish: null,
};
