const request = require("request");
const states = require("../public/assets/state_hash.json");

const subscriptionKey =
  process.env.TEXT_ANALYTICS_KEY1 || process.env.TEXT_ANALYTICS_KEY2;

module.exports = {
  analyzeText: (textfromOCR) => {
    const options = {
      uri:
        "https://centralindia.api.cognitive.microsoft.com/text/analytics/v2.1-preview/entities",
      body: JSON.stringify({
        documents: [
          {
            language: "en",
            id: "1",
            text: textfromOCR,
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    };
    return new Promise((resolve, reject) => {
      request.post(options, (error, response, body) => {
        if (error) {
          reject("Error while analyzing image");
        }
        if (response.statusCode == "200") {
          var leadDetails = {
            first_name: "",
            last_name: "",
            email: "",
            mobile: "",
            phone: "",
            company: "",
            city: "",
            state: "",
          };
          var entities = JSON.parse(body).Documents[0].Entities;
          entities.forEach((item) => {
            let type = item.Type;
            let val = item.Name;
            val = val.replace(/\s?\|\s+/g, " "); //Removes Garbage Delimiters
            val = val.trim(); //Trims to remove any extra whitespace
            if (type == "Person") {
              if (leadDetails.first_name == "") leadDetails.first_name = val;
              else leadDetails.last_name += val;
            } else if (type == "Email") leadDetails.email = val;
            else if (type == "Quantity" && val.length >= 10) {
              if (leadDetails.mobile == "") leadDetails.mobile = val;
              else leadDetails.phone = val;
            } else if (type == "Organization") leadDetails.company += val;
            else if (type == "Location") {
              if (
                Object.keys(states).indexOf(val.toUpperCase()) != -1 ||
                Object.values(states).indexOf(val.toUpperCase()) != -1
              )
                leadDetails.state += val;
              else leadDetails.city += val;
            }
          });
          resolve({ leadDetails });
        } else {
          reject("Error while analyzing image");
        }
      });
    });
  },
};
