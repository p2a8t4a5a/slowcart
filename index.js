require("dotenv").config();
const twilio = require("twilio");

const checkEnv = key => {
	if (!process.env[key]) {
		console.error(`${key} is required, but was not found.`);
		process.exit(1);
	}
};
checkEnv('INSTACART_EMAIL');
checkEnv('INSTACART_PASSWORD');

let twilioClient;
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER || !process.env.TWILIO_TO_NUMBER) {
	console.info("No twilio config found, skipping SMS");
} else {
	twilioClient = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}
const sendSMS = body => {
	if (!twilioClient) {
		return;
	}

	// fire and forgetting here, this _does_ return a promise.
	twilioClient.messages.create({
		to: process.env.TWILIO_TO_NUMBER,
		from: process.env.TWILIO_FROM_NUMBER,
		body
	});
};


const puppeteer = require("puppeteer");

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const login = async (page) => {
	console.log("Heading to instacart.com...");
  await page.goto("https://instacart.com");
  const loginButtonSelector = "header button";
  await page.waitFor(loginButtonSelector);
  await page.click(loginButtonSelector);

	console.log(`Logging in as ${process.env.INSTACART_EMAIL}...`);
  const emailFieldSelector = "input[type=email]";
  await page.waitFor(emailFieldSelector);
  await page.type(emailFieldSelector, process.env.INSTACART_EMAIL);
  const passwordFieldSelector = "input[type=password]";
  await page.waitFor(passwordFieldSelector);
  await page.type(passwordFieldSelector, process.env.INSTACART_PASSWORD);
  const loginSubmitSelector =
    "#main-content > div.rmq-766c96d2 > form > div:nth-child(7) > button";
  await page.click(loginSubmitSelector);
  await page.waitForNavigation();
};

const checkForDeliveries = async (page) => {
  await page.goto("https://www.instacart.com/store/checkout_v3");
  const deliveryOptionsSelector = "[id='Delivery options']";
  await page.waitFor(deliveryOptionsSelector);
  const optionsEl = await page.$(deliveryOptionsSelector);
  const optionsElText = await (
    await optionsEl.getProperty("textContent")
  ).jsonValue();
  const noDeliveries =
    optionsElText.indexOf("No delivery times available") >= 0;
  return !noDeliveries;
};

const say = (str) => require("child_process").execSync(`say ${str}`);

const checkUntilFoundOrFailed = async page => {
	let foundDelivery = false;
	let numExceptions = 0;
	while (!foundDelivery && numExceptions < 3) {
		console.log("Checking for deliveries...");
		try {
			foundDelivery = await checkForDeliveries(page);
			if (!foundDelivery) {
				console.log("none found, waiting...");
				await delay(60 * 1000);
			}
			numExceptions = 0;
		} catch (e) {
			console.error("Checking failed this time, waiting...", e);
			numExceptions += 1;
			if (numExceptions < 3) {
				await delay(60 * 1000);
			}
		}
	}
	return numExceptions < 3 ? Promise.resolve() : Promise.reject();
};

(async () => {
  const browser = await puppeteer.launch({ headless: !(process.env.SLOWCART_HEADLESS === "false"), args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();

    await login(page);

		await checkUntilFoundOrFailed(page);
		console.log("Found a delivery time!");
		sendSMS("Found a delivery time!");
  } catch (e) {
    console.error(e);
		sendSMS(`Slowcart is exiting because: ${e}`);
    await browser.close();
  }
})();
