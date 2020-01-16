const express = require("express");
const bodyParser = require("body-parser");
const hbs = require("express-handlebars");
const session = require("express-session");
const multer = require("multer");
const ocr = require("./services/ocr");
const textanalytics = require("./services/textanalytics");

//Set Storage Engine
const storage = multer.diskStorage({
  destination: "./public/uploads",
  filename: (req, file, cb) => {
    cb(null, req.session.user + ".jpeg");
  },
});

//Init Upload
const upload = multer({
  storage: storage,
  //   limits: { fileSize: 10 }
}).single("bcard");

const app = express();

//Express session middleware
app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
  })
);

app.set("view engine", "hbs");
app.set("views", __dirname + "/views/pages");

app.engine(
  "hbs",
  hbs({
    extname: "hbs",
    defaultLayout: "main",
  })
);

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: false }));

// Custom middleware to check user
const authenticator = (req, res, next) => {
  if (
    !req.session.user &&
    req.path != "/login" &&
    req.path != "/logout" &&
    req.path != "/"
  )
    res.render("login", { title: "Login", layout: false });
  else next();
};

app.use(authenticator);

app.get("/", (req, res) => {
  if (!req.session.user) res.render("splash", { layout: false });
  else res.redirect("home");
});

app.get("/login", (req, res) =>
  res.render("login", { title: "Login", layout: false })
);

app.post("/login", (req, res) => {
  const valid_users = JSON.parse(process.env.VALID_USERS);
  valid_users.forEach((element) => {
    if (
      element.uid == req.body.user.toUpperCase() &&
      req.body.pwd == element.pwd
    ) {
      req.session.user = req.body.user;
      req.session.uname = element.uname;
    }
  });

  if (!req.session.user) res.redirect("login");
  else res.redirect("home");
});

app.get("/listen", (req, res) => res.render("listen", { title: "Speak" }));

app.post("/listen", (req, res) => {
  textanalytics
    .analyzeText(req.body.notes)
    .then((response) => {
      req.session.lead = response.leadDetails;
      res.redirect("create-lead");
    })
    .catch((err) => {
      res.render("listen", { title: "Speak" });
    });
});

app.get("/upload-image", (req, res) => {
  res.render("upload-image", { title: "Image" });
});

app.get("/create-lead", (req, res) => {
  const data = {
    title: "Create Lead",
    advisor: req.session.user.toUpperCase(),
  };
  if (!req.query.type) data.lead = req.session.lead;
  res.render("createlead", data);
});

app.get("/home", (req, res) => {
  res.render("home", { title: "Home", uname: req.session.uname });
});

app.post("/upload", (req, res) => {
  upload(req, res, (err) => {
    if (err) res.render("error", { msg: err });
    else {
      if (req.file == undefined) res.render("home");
      else {
        const params = {
          mode: req.query.mode,
        };
        //Add logic to call Microsofts OCR API & Text Analytics
        const ocrResponse = ocr.getOCRText(req.session.user + ".jpeg", params);
        ocrResponse
          .then((resp) => {
            textanalytics
              .analyzeText(resp.ocrText)
              .then((response) => {
                req.session.lead = response.leadDetails;
                res.redirect("create-lead");
              })
              .catch(() => res.redirect("error"));
          })
          .catch(() => res.redirect("error"));
      }
    }
  });
});

app.post("/create-lead", (req, res) => {
  const createlead = require("./services/createlead");
  const options = {
    uri: "https://webto.salesforce.com/servlet/servlet.WebToLead",
    form: {
      oid: process.env.OID,
      "00N6F00000Skctv": req.body.advisor,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      email: req.body.email,
      company: req.body.company,
      city: req.body.city,
      state: req.body.state,
      mobile: req.body.mobile,
      phone: req.body.phone,
    },
  };
  createlead.create(options, res);
});

//Misc Routes
app.get("/success", (req, res) => {
  res.render("success", { title: "Lead Created" });
});

app.get("/error", (req, res) => {
  res.render("error", { title: "Oops ;(" });
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.render("logout", { title: "You've been logged out." });
});

// Default route for showing 404 page
app.get("*", function (req, res) {
  res.render("404", { title: "Page Not Found" });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Server running on " + port);
});
