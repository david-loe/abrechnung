
# make scripte executable: `chmod +x backups/backup.sh`
# Cron Entry “At 00:01 on Sunday.” `crontab -e`
# 1 0 * * 0 ~/PATH_TO_abrechnung/backups/backup.sh

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

# create backup
docker compose exec -T db sh -c 'exec mongodump -d abrechnung --archive' > $SCRIPTPATH/db-$(date +"%Y%m%dT%H%M").archive

# delete all backups older than 50 days
find $SCRIPTPATH -type f -mtime +50 -name '*.archive' -execdir rm -- '{}' \;


#### Restore
# Copy backup file
# docker compose cp backups/db-... db:/tmp/

# Delete current database  ATTENTION!!!
# docker compose exec -T db mongosh --eval "use abrechnung" --eval  "db.dropDatabase()"

# Restore Backup
# docker compose exec -T db mongorestore --archive=/tmp/db-...