from pymongo import MongoClient
import sqlite3
import csv
import requests
import base64


mydb=sqlite3.connect('project_db')
mycursor=mydb.cursor()

mycursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        uid VARCHAR PRIMARY KEY,
        name VARCHAR,
        elo_rating INT DEFAULT 1200,
        is_online BOOLEAN DEFAULT FALSE
    )
    ''')
mydb.commit()

MONGO_URI="mongodb+srv://hairband:hairband_a_s_h@cluster0.4ldl2pp.mongodb.net/project_db_mongo?retryWrites=true&w=majority" 
client=MongoClient(MONGO_URI)
db=client["project_DB_mongo"];
collection=db["profile_images"]

with open('batch_data.csv',mode='r')as file:
    suc=0
    notfound=0
    timeout=0
    coner=0
    unkno=0
    csvfile=csv.reader(file)
    next(csvfile)
    for row in csvfile:
        uid=row[0]
        name=row[1]
        website_url=row[2]
        image_url=website_url+"/images/pfp.jpg"
        image_url="https://"+image_url
        try:
            response=requests.get(image_url,timeout=5)

            if response.status_code ==200:
                image_b64 = base64.b64encode(response.content).decode("utf-8")
                collection.update_one(
                    {"uid": uid},
                    {"$set": {"image": image_b64}},
                    upsert=True
                )
                sql="""INSERT INTO users (uid,name) VALUES (?,?) ON CONFLICT(uid) DO UPDATE SET name = excluded.name"""
                mycursor.execute(sql,(uid,name))
                mydb.commit()
                print(f"uid:{uid} Successfully added")
                suc+=1
            else:
                print(f"uid:{uid}Image not found")
                notfound+=1
                
        except Exception as e:
            print(f"\nuid:{uid}")
            print("TYPE:", type(e))
            print("DETAILS:", repr(e))
        # except Exception as e:
        #     if isinstance(e,requests.exceptions.Timeout):
        #         print(f"uid:{uid} Error:Timeout")
        #         timeout+=1
        #     elif isinstance (e,requests.exceptions.ConnectionError):
        #         print(f"uid:{uid} Error:Connection Error")
        #         coner+=1
        #     else:
        #         print("Unknown Error") 
        #         unkno+=1   

print("Inserted successfully!")
print(f"No. of Successful entries:{suc}")
print(f"No. of Images not found:{notfound}")
print(f"No. of time out errors:{timeout}")
print(f"No. of connection errors:{coner}")
print(f"No. of unknown errors:{unkno}")
