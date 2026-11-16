# Let's Move

Let's Move is a full-stack fitness application where users can create exercises and routines, schedule activities, log workouts, and view saved workout history. Exercises and routines can be reused without entering the same information every time.

## Features

- Create an account, log in, and log out.
- Create, edit, and delete personal exercises and routines.
- Choose which measurements to record: sets, reps, weight (lb), duration (minutes), and distance (miles).
- Build routines from saved exercises and customize their measurements.
- Schedule routines and individual exercises in a Monday–Sunday weekly planner.
- View routine details and log scheduled workouts from the planner.
- Save workout measurements and notes, and return to unfinished logs.
- View saved workout history and filter it by date.
- Keep each user's exercises, routines, schedules, and logs private to their account.

## Technologies

- **Frontend:** React, JavaScript, CSS, Vite
- **Backend:** Python, Flask, Flask-SQLAlchemy, Flask-Migrate, Flask-Bcrypt
- **Database:** PostgreSQL
- **Authentication:** Flask sessions

## Installation and Setup

These instructions use an Ubuntu or WSL terminal. Install Python 3, PostgreSQL, Node.js, and npm before starting.

### 1. Clone the project

```bash
git clone https://github.com/liza4231/lets-move.git
cd lets-move
```

### 2. Create the PostgreSQL database

Start PostgreSQL if it is not already running, then open its command line:

```bash
sudo -u postgres psql
```

At the `postgres=#` prompt, run:

```sql
CREATE USER lets_move_user WITH PASSWORD 'choose_a_password';
CREATE DATABASE lets_move_db OWNER lets_move_user;
\q
```

Replace `choose_a_password` with a password you choose. Save it for the next step. If PostgreSQL reports that the user or database already exists, use your existing database details instead.

### 3. Install backend dependencies

From the project root:

```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Set up the backend configuration

The backend reads two settings from a file named `.env` inside `server`:

- `DATABASE_URL`: the PostgreSQL username, password, server address, port, and database name.
- `SECRET_KEY`: a random value Flask uses to protect login sessions.

While still in `server`, create the file:

```bash
touch .env
```

Open `server/.env` in a text editor and add:

```dotenv
DATABASE_URL=postgresql://lets_move_user:choose_a_password@localhost:5432/lets_move_db
SECRET_KEY=paste_your_generated_key_here
```

Use the password you chose in Step 2. Generate a secret key in your terminal with:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Copy the result into `.env` after `SECRET_KEY=`. Keep this file private; it contains your database password and session secret. If your password contains URL special characters, URL-encode them in the connection string.

### 5. Set up the tables and start Flask

In the `server` directory, with the virtual environment activated:

```bash
flask --app app db upgrade
flask --app app run --debug --port 5555
```

Leave Flask running in this terminal.

### 6. Start the frontend

Open a second terminal at the project root:

```bash
cd client
npm install
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`.

**API connection:** The React app requests `/api` endpoints. For local development, Vite needs to forward `/api` requests to Flask at `http://127.0.0.1:5555`. Check `client/vite.config.js` for a `server.proxy` entry for `/api` if registration or login requests fail. The frontend and backend must both be running.

## Build and Lint

From `client`:

```bash
npm run build
npm run lint
```

## Project Structure

- `client/src/` — React components and styles
- `server/app.py` — Flask API routes
- `server/models.py` — database models
- `server/migrations/` — database migrations
