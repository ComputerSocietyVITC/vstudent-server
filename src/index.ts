import express, { Application, Request, Response, json } from "express";
import morgan from "morgan";
import { Browser, Page, launch } from "puppeteer";

import { v4 as uuidv4 } from "uuid";
import ParseCaptcha from "../helpers/parseCaptcha";
import HandleSemesterValues from "./helpers/parseSemesters";

const port: number = parseInt(process.env.PORT || "3000", 10);

const sessions: Map<string, Page> = new Map();
let browser: Browser;

const app: Application = express();
app.use(json());

const nginxFormat =
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status';

app.use(morgan(nginxFormat));

/* Get session */
app.get("/sessions/getSession", async (_: Request, res: Response) => {
  try {
    browser = await launch({ headless: true });
    const context: Page = await browser.newPage();
    let ctxt_id: string = uuidv4();
    sessions.set(ctxt_id, context);
    res.status(200).send({ sessionId: ctxt_id });
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: err });
  }
});

/* Delete Session */
app.delete(
  "/sessions/closeSession/:sessionId",
  async (req: Request, res: Response) => {
    const sessionId: string = req.params.sessionId;
    const session: Page | undefined = sessions.get(sessionId);
    if (session != undefined) {
      await session.close();
      sessions.delete(sessionId);
      res.status(200).send({ Message: "Session closed" });
    } else {
      res.status(403).send({ Message: "Invalid Session ID" });
    }
  }
);

/* Get Captcha */
app.get("/auth/captcha/:sessionId", async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;

  const session = sessions.get(sessionId);
  if (session != undefined) {
    let page = session!;

    await page.goto("https://vtopcc.vit.ac.in/vtop/login");
    try {
      await page.click("#stdForm");
    } catch (e) {
      console.log("Maybe already in the student login page");
    }
    let ele: string = "";
    let captchaPresent: boolean = false;

    while (captchaPresent != true) {
      await page.waitForTimeout(500);
      let element = await page.$("#captchaBlock");
      if (element != null) {
        ele = ParseCaptcha(await page.content());
        captchaPresent = true;
      } else {
        await page.reload();
      }
    }
    if (captchaPresent) {
      console.log(`Captcha sent for ${sessionId}`);
      res.status(200).send({ captcha: ele });
    } else {
      res.status(200).send({ captchaPresent: false, captcha: "No Captcha" });
    }
  } else {
    res.status(498).send({ Message: "Invalid Session ID" });
  }
});

/* Login */
app.post("/auth/login/:sessionId", async (req: Request, res: Response) => {
  const sessionId: string = req.params.sessionId;
  const session: Page | undefined = sessions.get(sessionId);
  if (session != undefined) {
    const { username, password, captcha } = req.body;
    let page: Page = session!;

    await page.type("#username", username);
    await page.type("#password", password);
    await page.type("#captchaStr", captcha);

    await page.click("#submitBtn");

    await page.waitForNavigation();
    let url = await page.url();

    if (url == "https://vtopcc.vit.ac.in/vtop/content") {
      res.status(200).send({ Message: "Logged in successfully" });
    } else {
      res.status(403).send({ Message: "Invalid Credentials/Captcha" });
    }
  } else {
    res.status(498).send({ Message: "Invalid session" });
  }
});

/* Get Time Table -> Just requires number */
app.get(
  "/auth/timetable/:sessionId/:semname",
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId;
    const session: Page | undefined = sessions.get(sessionId);
    if (session != undefined) {
      try {
        const semname = req.params.semname;
        let page = session!;

        await page.click("#vtopHeader > div > button:nth-child(1)");
        console.log("Clicked on Sidebar");

        await page.waitForTimeout(125);

        await page.click("#acMenuItemHDG0067 > button");
        await page.waitForTimeout(125);
        console.log("Clicked on Academics");

        await page.click("#acMenuCollapseHDG0067 > div > a:nth-child(8)");
        await page.waitForTimeout(125);
        console.log("Clicked on Time Table");

        await page.click("#acMenuItemHDG0067 > button");
        await page.waitForTimeout(125);
        console.log("Closed Academics sub bar");

        //*[@id="expandedSideBar"]/div[1]/button
        await page.click("#expandedSideBar>div:nth-child(1)>button");
        await page.waitForTimeout(125);
        console.log("Closed Sidebar");

        let dropDown = await page.$("#semesterSubId");
        await page.waitForTimeout(250);

        // Select timetable
        await dropDown!.select(semname);
        await page.waitForTimeout(800);

        let text_response = await page.content();
        res.status(200).send(text_response);
        await page.reload();
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Error getting captcha" });
      }
    } else {
      res.status(498).send({ Message: "Invalid Session ID" });
    }
  }
);

/* Get semester details */
app.get(
  "/auth/semesterDetails/:sessionId",
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId;
    const session: Page | undefined = sessions.get(sessionId);
    if (session != undefined) {
      try {
        let page = session!;

        await page.click("#vtopHeader > div > button:nth-child(1)");
        console.log("Clicked on Sidebar");

        await page.waitForTimeout(125);

        await page.click("#acMenuItemHDG0067 > button");
        await page.waitForTimeout(125);
        console.log("Clicked on Academics");

        await page.click("#acMenuCollapseHDG0067 > div > a:nth-child(8)");
        await page.waitForTimeout(125);
        console.log("Clicked on Time Table");

        await page.click("#acMenuItemHDG0067 > button");
        await page.waitForTimeout(125);
        console.log("Closed Academics sub bar");

        //*[@id="expandedSideBar"]/div[1]/button
        await page.click("#expandedSideBar>div:nth-child(1)>button");
        await page.waitForTimeout(125);
        console.log("Closed Sidebar");

        let semester_response = HandleSemesterValues(await page.content());
        res.status(200).send({ semesters: semester_response });
        await page.reload();
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Error getting captcha" });
      }
    } else {
      res.status(498).send({ Message: "Invalid Session ID" });
    }
  }
);

/* Get Attendance Details */
app.get(
  "/auth/attendance/:sessionId/:semesterUniqueID",
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId;
    const session = sessions.get(sessionId);
    if (session != undefined) {
      const semesterUniqueID = req.params.semesterUniqueID;

      let page = session!;

      await page.waitForNavigation();

      await page.click("#vtopHeader > div > button:nth-child(1)");
      console.log("Clicked on Sidebar");
      await page.waitForTimeout(175);

      await page.click("#acMenuItemHDG0067 > button");
      console.log("Clicked on Academics");
      await page.waitForTimeout(175);

      await page.click("#acMenuCollapseHDG0067 > div > a:nth-child(11)");
      console.log("Clicked on Attendance");
      await page.waitForTimeout(175);

      await page.click("#acMenuItemHDG0067 > button");
      console.log("Closed sub academics");
      await page.waitForTimeout(175);

      await page.click("#expandedSideBar>div:nth-child(1)>button");
      console.log("Closed sidebar");
      await page.waitForTimeout(175);

      let dropDown = await page.$("#semesterSubId");
      dropDown!.select(semesterUniqueID);
      console.log("Selected semester");
      dropDown!.click();

      const button = await page.$("button.btn.btn-md.btn-primary.btn-block");
      await button?.click();
      console.log("Clicked on Submit");
      await page.waitForTimeout(1000);

      res.status(200).send(await page.content());
      await page.reload();
    } else {
      res.status(498).send({ Message: "Invalid Session ID" });
    }
  }
);

/* Get Mark Details */
app.get(
  "/auth/marks/:sessionId/:semesterUniqueID",
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId;
    const session = sessions.get(sessionId);

    if (session != undefined) {
      const semesterUniqueID = req.params.semesterUniqueID;
      let page: Page = session!;
      await page.waitForNavigation();

      await page.click("#vtopHeader > div > button:nth-child(1)");
      await page.waitForTimeout(125);
      console.log("Selected the sidebar");

      await page.click("#acMenuItemHDG0070 > button");
      await page.waitForTimeout(125);
      console.log("Clicked on Examinations");

      await page.click("#acMenuCollapseHDG0070 > div > a:nth-child(2)");
      await page.waitForTimeout(125);
      console.log("Clicked something I don't know probably marks");

      await page.click("#acMenuItemHDG0067 > button");
      await page.waitForTimeout(125);
      console.log("Closed sub academics");

      await page.click("#expandedSideBar > div:nth-child(1) > button");
      await page.waitForTimeout(125);
      console.log("Closed sidebar");

      await page.select("#semesterSubId", semesterUniqueID);
      await page.waitForTimeout(550);

      res.status(200).send(await page.content());
      await page.reload();
    } else {
      res.status(498).send({ Message: "Invalid Session ID" });
    }
  }
);

/* Get PPTR GradeHistory */
app.get(
  "/auth/gradeHistory/:sessionId/",
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId;
    const session = sessions.get(sessionId);

    if (session != undefined) {
      let page = session!;
      await page.waitForNavigation();

      await page.click("#vtopHeader > div > button:nth-child(1)");
      console.log("Clicked on Sidebar");
      await page.waitForTimeout(125);

      await page.click("#acMenuItemHDG0070 > button");
      console.log("Clicked on Examinations");
      await page.waitForTimeout(125);

      await page.click("#acMenuCollapseHDG0070 > div > a:nth-child(5)");
      await page.waitForTimeout(125);
      console.log("Clicked on Grade History");

      await page.click("#expandedSideBar > div:nth-child(1) > button");
      console.log("Closed sidebar");
      await page.waitForTimeout(175);

      await page.waitForTimeout(1000);

      res.status(200).send(await page.content());
      await page.reload();
    } else {
      res.status(498).send({ Message: "Invalid Session ID" });
    }
  }
);

app.get("/test", (_: Request, res: Response) => {
  res.status(200).send("Test");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
