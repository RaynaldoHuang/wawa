# Deploy WAWA ke DigitalOcean Droplet (2 vCPU) dengan PM2

Panduan ini dibuat untuk deploy project ini ke 1 Droplet DigitalOcean dengan stack:

- Ubuntu 24.04 LTS
- Node.js 20
- PM2 (process manager)
- Nginx (reverse proxy)
- PostgreSQL (database)
- Redis (queue/cache)
- SSL gratis dari Let's Encrypt

Panduan ini asumsi:

- Domain sudah ada (contoh: `app.domainkamu.com`)
- Repo ada di GitHub
- Kamu deploy sebagai user non-root (best practice)

## 0) Ringkasan Arsitektur

- Aplikasi Next.js jalan di `127.0.0.1:3000` via PM2
- Nginx expose ke internet di port `80/443`
- PostgreSQL dan Redis jalan di server yang sama (localhost)
- Session WhatsApp tersimpan di folder `storages/wa-sessions`

## 1) Buat Droplet + DNS

1. Buat Droplet di DigitalOcean:
   - Image: Ubuntu 24.04 LTS
   - Plan: Basic, 2 vCPU (sesuaikan RAM sesuai budget)
   - Authentication: SSH key (sangat disarankan), bukan password

2. Arahkan DNS:
   - Buat `A record` ke IP Droplet
   - Contoh:
     - Host: `app`
     - Value: `IP_DROPLET`

3. Login awal:

```bash
ssh root@IP_DROPLET
```

## 2) Setup Dasar Server (Hardening)

Jalankan sebagai `root`:

```bash
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban ca-certificates gnupg lsb-release
timedatectl set-timezone Asia/Jakarta
```

### Buat user deploy non-root

```bash
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Test login:

```bash
ssh deploy@IP_DROPLET
```

### Aktifkan firewall

Kembali sebagai root (atau pakai sudo):

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable
ufw status
```

### Opsional tapi sangat disarankan: nonaktifkan SSH password login

Edit `/etc/ssh/sshd_config`:

```text
PasswordAuthentication no
PermitRootLogin prohibit-password
```

Lalu:

```bash
systemctl restart ssh
```

## 3) Install Node.js 20 + PM2 + Nginx

Login sebagai `deploy`:

```bash
ssh deploy@IP_DROPLET
```

Install Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential
node -v
npm -v
```

Install PM2 global:

```bash
sudo npm install -g pm2
pm2 -v
```

Install Nginx:

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## 4) Install & Setup PostgreSQL + Redis

### PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Buat database + user:

```bash
sudo -u postgres psql
```

Di prompt PostgreSQL:

```sql
CREATE USER wawa_user WITH PASSWORD 'GANTI_PASSWORD_DB_YANG_KUAT';
CREATE DATABASE wawa_db OWNER wawa_user;
GRANT ALL PRIVILEGES ON DATABASE wawa_db TO wawa_user;
\q
```

### Redis

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

Pastikan Redis hanya listen lokal:

```bash
sudo sed -i "s/^# \?bind .*/bind 127.0.0.1 ::1/" /etc/redis/redis.conf
sudo sed -i "s/^protected-mode .*/protected-mode yes/" /etc/redis/redis.conf
sudo systemctl restart redis-server
redis-cli ping
```

Jika output `PONG`, Redis siap.

## 5) Clone Project di Server

Pilih direktori deploy, contoh `/var/www/wawa`:

```bash
sudo mkdir -p /var/www
sudo chown -R deploy:deploy /var/www
cd /var/www
```

Clone repo:

```bash
git clone https://github.com/RaynaldoHuang/wawa.git
cd wawa
git checkout dev
```

Catatan:

- Jika branch produksi kamu bukan `dev`, ganti ke branch yang benar.
- Jika repo private, gunakan SSH key deploy key/PAT sesuai kebijakan repo.

## 6) Siapkan Environment Production

Copy template env:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
nano .env
```

Isi minimal seperti ini:

```env
APP_MODE=production

BETTER_AUTH_SECRET=ISI_RANDOM_SECRET_PANJANG
BETTER_AUTH_URL=https://app.domainkamu.com

DATABASE_URL=postgresql://wawa_user:GANTI_PASSWORD_DB_YANG_KUAT@127.0.0.1:5432/wawa_db?schema=public
REDIS_URL=redis://127.0.0.1:6379
```

Generate secret yang aman:

```bash
openssl rand -base64 48
```

Penting:

- `BETTER_AUTH_URL` harus domain HTTPS final (bukan localhost)
- Jangan commit `.env` ke git

## 7) Install Dependency + Build

Di folder project (`/var/www/wawa`):

```bash
npm ci
npx prisma generate
```

Karena repo ini belum punya folder `prisma/migrations`, untuk deploy awal gunakan:

```bash
npm run db:push
```

Lalu build:

```bash
npm run build
```

Catatan penting untuk production:

- Jangan jalankan `npm run db:seed` di production.
- File `prisma/seed.ts` melakukan penghapusan data (`deleteMany`) sebelum isi ulang data contoh.

## 8) Jalankan Aplikasi dengan PM2

Start app:

```bash
cd /var/www/wawa
pm2 start npm --name wawa -- start
pm2 status
```

Set auto-start saat reboot:

```bash
pm2 save
pm2 startup systemd -u deploy --hp /home/deploy
```

Jalankan command yang ditampilkan PM2 (biasanya pakai `sudo ...`) lalu:

```bash
pm2 save
```

Cek log:

```bash
pm2 logs wawa
```

## 9) Konfigurasi Nginx Reverse Proxy

Buat file site config:

```bash
sudo nano /etc/nginx/sites-available/wawa
```

Isi config:

```nginx
server {
    listen 80;
    server_name app.domainkamu.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Aktifkan site:

```bash
sudo ln -s /etc/nginx/sites-available/wawa /etc/nginx/sites-enabled/wawa
sudo nginx -t
sudo systemctl reload nginx
```

## 10) Aktifkan HTTPS (Let's Encrypt)

Install certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Request SSL:

```bash
sudo certbot --nginx -d app.domainkamu.com
```

Tes auto-renew:

```bash
sudo certbot renew --dry-run
```

## 11) Checklist Verifikasi

1. App bisa diakses di `https://app.domainkamu.com`
2. Login/auth berjalan normal
3. API route normal (termasuk fitur queue)
4. PM2 status online:

```bash
pm2 status
```

5. Service sistem sehat:

```bash
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status redis-server
```

6. Port publik hanya 22, 80, 443:

```bash
sudo ufw status
```

## 12) Prosedur Update Deploy Berikutnya

Setiap ada update kode:

```bash
cd /var/www/wawa
git fetch origin
git checkout dev
git pull origin dev

npm ci
npx prisma generate
npm run db:push
npm run build

pm2 restart wawa --update-env
pm2 save
```

Jika nanti kamu sudah memakai migration versioned (`prisma/migrations`), ganti langkah schema deploy dari `npm run db:push` menjadi:

```bash
npx prisma migrate deploy
```

## 13) Troubleshooting Cepat

### App tidak jalan setelah reboot

```bash
pm2 resurrect
pm2 save
```

### 502 Bad Gateway dari Nginx

1. Cek app PM2:

```bash
pm2 status
pm2 logs wawa --lines 200
```

2. Cek Nginx:

```bash
sudo nginx -t
sudo tail -n 200 /var/log/nginx/error.log
```

### Gagal konek database

1. Pastikan PostgreSQL running:

```bash
sudo systemctl status postgresql
```

2. Test koneksi manual:

```bash
psql "postgresql://wawa_user:GANTI_PASSWORD_DB_YANG_KUAT@127.0.0.1:5432/wawa_db"
```

### Queue tidak memproses

1. Cek Redis:

```bash
redis-cli ping
```

2. Pastikan `REDIS_URL` benar di `.env`
3. Restart app:

```bash
pm2 restart wawa --update-env
```

## 14) Rekomendasi Keamanan Lanjutan

1. Aktifkan backup harian PostgreSQL (cron + `pg_dump`)
2. Simpan `.env` di secret manager (bukan plaintext jangka panjang)
3. Pasang monitoring (Netdata/Uptime Kuma/Grafana)
4. Pertimbangkan Managed PostgreSQL/Redis DigitalOcean untuk reliability lebih tinggi

---

Selesai. Dengan langkah di atas, project ini dapat berjalan stabil di Droplet 2 vCPU menggunakan PM2 sebagai process manager dan Nginx + SSL untuk akses publik yang aman.
