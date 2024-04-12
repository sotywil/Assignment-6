const express = require('express');
const app = express();
app.set('view engine', 'ejs');
const clientSessions = require('client-sessions');

const HTTP_PORT = process.env.PORT || 8080;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(
  clientSessions({
    cookieName: 'session',
    secret: 'o6LjQ5EVNC28ZgK64hDELM18ScpFQr',
    duration: 2 * 60 * 1000,
    activeDuration: 1000 * 60,
  })
);

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

function ensureLogin(req, res, next) {
  if (!req.session.user) {
    res.redirect('/login');
  } else {
    next();
  }
}

const unCountryData = require('./modules/unCountries');
const authData = require('./modules/auth-service');

(async () => {
  try {
    await unCountryData.initialize();
    await authData.initialize();
    app.listen(HTTP_PORT, () =>
      console.log(`server listening on: ${HTTP_PORT}`)
    );
  } catch (error) {
    console.error('Error starting server:', error);
  }
})();

app.get('/', (req, res) => {
  res.render('home');
});

app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/un/countries', async (req, res) => {
  const region = req.query.region;

  try {
    let countries;
    if (region) {
      countries = await unCountryData.getCountriesByRegion(region);
    } else {
      countries = await unCountryData.getAllCountries();
    }
    res.render('countries', { countries });
  } catch (message) {
    res.status(404).render('404', { message });
  }
});

app.get('/un/countries/:a2Code', async (req, res) => {
  const countryCode = req.params.a2Code;

  if (!countryCode) {
    return res
      .status(404)
      .render('404', { message: 'Invalid request. Missing a2Code parameter.' });
  }

  try {
    const country = await unCountryData.getCountryByCode(countryCode);
    res.render('country', { country: country });
  } catch (message) {
    res.status(404).render('404', { message });
  }
});

app.get('/un/addCountry', ensureLogin, async (req, res) => {
  try {
    const regions = await unCountryData.getAllRegions();
    res.render('addCountry', { regions: regions });
  } catch (message) {
    res.status(404).render('404', { message });
  }
});

app.post('/un/addCountry', ensureLogin, async (req, res) => {
  try {
    await unCountryData.addCountry(req.body);
    res.redirect('/un/countries');
  } catch (err) {
    res.render('500', {
      message: `I'm sorry, but we have encountered the following error: ${err}`,
    });
  }
});

app.get('/un/editCountry/:code', ensureLogin, async (req, res) => {
  const countryCode = req.params.code;

  if (!countryCode) {
    return res
      .status(404)
      .render('404', { message: 'Invalid request. Missing a2Code parameter.' });
  }

  try {
    const [countryData, regionsData] = await Promise.all([
      unCountryData.getCountryByCode(countryCode),
      unCountryData.getAllRegions(),
    ]);
    res.render('editCountry', { regions: regionsData, country: countryData });
  } catch (err) {
    res.status(404).render('404', { message: err });
  }
});

app.post('/un/editCountry', ensureLogin, async (req, res) => {
  try {
    await unCountryData.editCountry(req.body.a2code, req.body);
    res.redirect('/un/countries');
  } catch (err) {
    res.render('500', {
      message: `I'm sorry, but we have encountered the following error: ${err}`,
    });
  }
});

app.get('/un/deleteCountry/:code', ensureLogin, async (req, res) => {
  const countryCode = req.params.code;

  if (!countryCode) {
    return res
      .status(404)
      .render('404', { message: 'Invalid request. Missing a2Code parameter.' });
  }

  try {
    await unCountryData.deleteCountry(countryCode);
    res.redirect('/un/countries');
  } catch (err) {
    res.render('500', {
      message: `I'm sorry, but we have encountered the following error: ${err}`,
    });
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  try {
    await authData.registerUser(req.body);
    res.render('register', { successMessage: 'User created' });
  } catch (err) {
    res.render('register', { errorMessage: err, userName: req.body.userName });
  }
});

app.post('/login', async (req, res) => {
  req.body.userAgent = req.get('User-Agent');
  try {
    const user = await authData.checkUser(req.body);
    req.session.user = {
      userName: user.userName,
      email: user.email,
      loginHistory: user.loginHistory,
    };
    res.redirect('/un/countries');
  } catch (err) {
    res.render('login', { errorMessage: err, userName: req.body.userName });
  }
});

app.get('/logout', (req, res) => {
  req.session.reset();
  res.redirect('/');
});

app.get('/userHistory', ensureLogin, (req, res) => {
  res.render('userHistory');
});

app.use((req, res, next) => {
  res.status(404).render('404', {
    message: "I'm sorry, we're unable to find what you're looking for",
  });
});
