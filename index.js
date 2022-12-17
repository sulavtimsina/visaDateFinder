const puppeteer = require('puppeteer');
const { parseISO, compareAsc, isBefore, format } = require('date-fns')
const player = require('play-sound')(opts = {})
require('dotenv').config();

const { delay, sendEmail, logStep } = require('./utils');
const { siteInfo, loginCred, IS_PROD, NEXT_SCHEDULE_POLL, MAX_NUMBER_OF_POLL, NOTIFY_ON_DATE_BEFORE } = require('./config');
const { mainModule } = require('process');

let isLoggedIn = false;
let maxTries = MAX_NUMBER_OF_POLL

const login = async (page) => {
  logStep('logging in');
  await page.goto(siteInfo.LOGIN_URL);

  await page.goto('https://ais.usvisa-info.com/en-ae/niv/users/sign_in');
  await page.type('#user_email', 'dahal.anup757@gmail.com');
  await page.type('#user_password', 'Nepal@990');
  await page.click('.icheck-area-20')
  await page.click('.button')

  await page.waitForNavigation();

  return true;
}

const notifyMe = async (earliestDate) => {
  const formattedDate = format(earliestDate, 'dd-MM-yyyy');
  logStep(`sending an email to schedule for ${formattedDate}`);
  await sendEmail({
    subject: `We found an earlier date ${formattedDate}`,
    text: `Hurry and schedule for ${formattedDate} before it is taken.`
  })
}

const checkForSchedules = async (page) => {
  logStep('checking for schedules');
  await page.goto(siteInfo.APPOINTMENTS_JSON_URL);

  const originalPageContent = await page.content();
  const bodyText = await page.evaluate(() => {
    return document.querySelector('body').innerText
  });

  try {
    console.log(bodyText);
    const parsedBody = JSON.parse(bodyText);

    if (!Array.isArray(parsedBody)) {
      throw "Failed to parse dates, probably because you are not logged in";
    }

    const dates = parsedBody.map(item => parseISO(item.date));
    const [earliest] = dates.sort(compareAsc)

    return earliest;
  } catch (err) {
    console.log("Unable to parse page JSON content", originalPageContent);
    console.error(err)
    isLoggedIn = false;
  }
}


const process = async (browser) => {
  logStep(`starting process with ${maxTries} tries left`);

  if (maxTries-- <= 0) {
    console.log('Reached Max tries')
    return
  }

  const page = await browser.newPage();

  if (!isLoggedIn) {
    isLoggedIn = await login(page);
  }

  const earliestDate = await checkForSchedules(page);
  if (earliestDate && isBefore(earliestDate, parseISO(NOTIFY_ON_DATE_BEFORE))) {
    // await notifyMe(earliestDate);

    player.play('longaudio.mp3', function (err) {
      if (err) throw err
    })
  }

  await delay(NEXT_SCHEDULE_POLL)

  await process(browser)
}

(async () => {
  const browser = await puppeteer.launch(undefined);
  await process(browser)
})();