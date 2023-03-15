const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let app = express();
app.use(express.json());
async function start() {
  try {
    db = await open({
      filename: __dirname + "/covid19IndiaPortal.db",
      driver: sqlite3.Database,
    });
    app.listen(3000, () => console.log("server started at 3000"));
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
}
start();

const authenticate = async (request, response, next) => {
  let { username, password } = request.body;
  let userEnq = `select * from user where username="${username}";`;
  let dbUser = await db.get(userEnq);
  if (dbUser !== undefined) {
    let checker = await bcrypt.compare(password, dbUser.password);
    if (checker === true) {
      next();
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
};

const authWithJwt = async (request, response, next) => {
  let auth = request.headers["authorization"];
  if (auth === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    let token = auth.split(" ")[1];
    jwt.verify(token, "secret_key", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", authenticate, async (request, response) => {
  let { username } = request.body;
  let payLoad = { username };
  const jwtToken = jwt.sign(payLoad, "secret_key");
  response.send({ jwtToken: jwtToken });
});

app.get("/states/", authWithJwt, async (request, response) => {
  let query = `select * from state`;
  let temp = await db.all(query);
  let result = temp.map((obj) => {
    return {
      stateId: obj.state_id,
      stateName: obj.state_name,
      population: obj.population,
    };
  });
  response.send(result);
});

app.get("/states/:stateId/", authWithJwt, async (request, response) => {
  let { stateId } = request.params;
  let query = `select * from state where state_id=${stateId}`;
  let obj = await db.get(query);
  let result = {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
  response.send(result);
});

app.post("/districts/", authWithJwt, async (request, response) => {
  let { districtName, stateId, cases, cured, active, deaths } = request.body;
  let query = `insert into district (district_name,state_id, cases, cured, active, deaths)
    values("${districtName}",${stateId},${cases},
    ${cured},${active},${deaths})`;
  await db.run(query);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId/", authWithJwt, async (request, response) => {
  let { districtId } = request.params;
  let query = `select * from district where district_id=${districtId}`;
  let temp = await db.get(query);
  let result = {
    districtId: temp.district_id,
    districtName: temp.district_name,
    stateId: temp.state_id,
    cases: temp.cases,
    cured: temp.cured,
    active: temp.active,
    deaths: temp.deaths,
  };
  response.send(result);
});

app.delete(
  "/districts/:districtId/",
  authWithJwt,
  async (request, response) => {
    let { districtId } = request.params;
    let query = `delete from district where district_id=${districtId}`;
    await db.run(query);
    response.send("District Removed");
  }
);

app.put("/districts/:districtId/", authWithJwt, async (request, response) => {
  let { districtId } = request.params;
  let { districtName, stateId, cases, active, cured, deaths } = request.body;
  let query = `update district set 
    district_name="${districtName}",state_id=${stateId},cases=${cases},
    active=${active},cured=${cured},deaths=${deaths}
     where district_id=${districtId}`;
  await db.run(query);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", authWithJwt, async (request, response) => {
  let { stateId } = request.params;
  let query = `select sum(district.cases) as cases,
  sum(district.cured) as cured,
  sum(district.active) as active,
  sum(district.deaths) as deaths
  from state inner join district on state.state_id=district.state_id
  where state.state_id=${stateId}
  group by state.state_id`;
  let temp = await db.get(query);
  console.log(temp);
  let result = {
    totalCases: temp.cases,
    totalCured: temp.cured,
    totalActive: temp.active,
    totalDeaths: temp.deaths,
  };
  response.send(result);
});

module.exports = app;
