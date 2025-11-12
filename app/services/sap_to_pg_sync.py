import logging
import os
import pyodbc
import psycopg2
from psycopg2.extras import execute_batch
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ===============================
#  SAP HANA CONNECTION SETTINGS
# ===============================
SAP_HANA_CONFIG = {
    "server": "192.168.1.231",
    "port": 30015,
    "database": "SYSTEM",
    "username": "SYSTEM",
    "password": "F@bc0m@S@p",
    "driver": "HDBODBC",
}

# ===============================
#  POSTGRES CONNECTION SETTINGS
# ===============================
POSTGRES_CONFIG = {
    "host": "localhost",
    "port": 1551,
    "dbname": "pdrinv_db",
    "user": "postgres",
    "password": "Solo1551",
}

# ===============================
# SAP QUERY WITH CORRECT SCHEMA
# ===============================
ARTICLES_QUERY = """
SELECT 
    T0."ItemCode",
    T0."ItemName",
    T0."SuppCatNum",
    T1."WhsCode",
    T2."BinCode",
    T1."OnHandQty"
FROM "FABCOM_DEV".OITM T0
INNER JOIN "FABCOM_DEV".OIBQ T1 ON T0."ItemCode" = T1."ItemCode"
INNER JOIN "FABCOM_DEV".OBIN T2 ON T1."BinAbs" = T2."AbsEntry"
WHERE T1."WhsCode" ='MGC/PR' AND T1."OnHandQty" <> 0
ORDER BY T2."BinCode" ASC;
"""

# ===============================
# MAIN SYNC FUNCTION
# ===============================
def sync_articles():
    logger.info("🚀 Starting SAP ➝ PostgreSQL sync...")

    # ---- CONNECT TO SAP HANA ----
    hana_conn_str = (
        f"DRIVER={{{SAP_HANA_CONFIG['driver']}}};"
        f"SERVERNODE={SAP_HANA_CONFIG['server']}:{SAP_HANA_CONFIG['port']};"
        f"DATABASE={SAP_HANA_CONFIG['database']};"
        f"UID={SAP_HANA_CONFIG['username']};"
        f"PWD={SAP_HANA_CONFIG['password']};"
    )
    
    logger.info(f"Connecting to SAP HANA with: {hana_conn_str.replace(SAP_HANA_CONFIG['password'], '***')}")
    
    try:
        hana_conn = pyodbc.connect(hana_conn_str)
        hana_cursor = hana_conn.cursor()
        
        hana_cursor.execute(ARTICLES_QUERY)
        sap_rows = hana_cursor.fetchall()
        logger.info(f"✅ Retrieved {len(sap_rows)} articles from SAP HANA")

        # ---- CONNECT TO POSTGRES ----
        pg_conn = psycopg2.connect(**POSTGRES_CONFIG)
        pg_cursor = pg_conn.cursor()

        # ---- USE UPSERT INSTEAD OF TRUNCATE ----
        UPSERT_SQL = """
            INSERT INTO articles 
            (numero_article, description_article, catalogue_fournisseur, 
            code_entrepot, code_emplacement, quantite_en_stock)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (numero_article) 
            DO UPDATE SET
                description_article = EXCLUDED.description_article,
                catalogue_fournisseur = EXCLUDED.catalogue_fournisseur,
                code_entrepot = EXCLUDED.code_entrepot,
                code_emplacement = EXCLUDED.code_emplacement,
                quantite_en_stock = EXCLUDED.quantite_en_stock,
                updated_at = CURRENT_TIMESTAMP
        """

        batch_data = [
            (
                str(row[0]) if row[0] is not None else "",      # ItemCode
                str(row[1]) if row[1] is not None else "",      # ItemName
                str(row[2]) if row[2] is not None else "",      # SuppCatNum
                str(row[3]) if row[3] is not None else "",      # WhsCode
                str(row[4]) if row[4] is not None else "",      # BinCode
                int(row[5]) if row[5] is not None else 0        # OnHandQty
            )
            for row in sap_rows
        ]

        execute_batch(pg_cursor, UPSERT_SQL, batch_data, page_size=2000)
        pg_conn.commit()

        logger.info(f"✅ Successfully upserted {len(batch_data)} records into PostgreSQL")

        # ---- CLOSE CONNECTIONS ----
        hana_conn.close()
        pg_cursor.close()
        pg_conn.close()

        logger.info(f"🏁 Sync complete at {datetime.now()}")
        
    except pyodbc.Error as e:
        logger.error(f"❌ SAP HANA Connection Error: {e}")
        raise
    except psycopg2.Error as e:
        logger.error(f"❌ PostgreSQL Error: {e}")
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected Error: {e}")
        raise


if __name__ == "__main__":
    try:
        sync_articles()
    except Exception as e:
        logger.error(f"❌ Sync failed: {e}")
        raise