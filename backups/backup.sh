
# make scripte executable: `chmod +x backups/backup.sh`
# Cron Entry “At 00:01 on Sunday.” `crontab -e`
# 1 0 * * 0 ~/projects/meal-week/backups/backup.sh

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

# create backup
docker exec meal-week-db-1 sh -c 'exec mongodump -d reisekostenabrechnung --archive' > $SCRIPTPATH/db-$(date +"%Y%m%dT%H%M").archive

# delete all backups older than 50 days
find $SCRIPTPATH -type f -mtime +50 -name '*.archive' -execdir rm -- '{}' \;

