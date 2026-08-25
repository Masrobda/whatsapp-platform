# NEXT LTD - WhatsApp Business API Documentation

## 🚀 Introduction

NEXT LTD (Numeric EXport Technologies) fournit une API REST pour envoyer des messages WhatsApp Business via 360dialog.

**URL de base:** `https://api.numericexport.com/api/v1`

## 🔐 Authentification

Deux méthodes d'authentification sont disponibles :

### 1. API Token (Pour l'envoi de messages)
```bash
Authorization: Bearer nxt_your_api_token_here
```

### 2. JWT Token (Pour le dashboard)
```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📱 Envoyer des Messages

### Message Texte Simple

```bash
curl -X POST https://api.numericexport.com/api/v1/messages/send \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_phone": "+237600000000",
    "message_type": "text",
    "message_content": "Bonjour ! Ceci est un message de test."
  }'
```

### Message Template

```bash
curl -X POST https://api.numericexport.com/api/v1/messages/send \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_phone": "+237600000000",
    "message_type": "template",
    "template_name": "hello_world",
    "template_language": "fr",
    "template_params": ["John", "15"]
  }'
```

### Message avec Média (Image)

```bash
curl -X POST https://api.numericexport.com/api/v1/messages/send \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_phone": "+237600000000",
    "message_type": "media",
    "media_type": "image",
    "media_url": "https://example.com/image.jpg",
    "message_content": "Voici votre image"
  }'
```

## 📊 Exemples de Code

### PHP

```php
<?php
$apiToken = 'nxt_your_api_token';
$apiUrl = 'https://api.numericexport.com/api/v1/messages/send';

$data = [
    'recipient_phone' => '+237600000000',
    'message_type' => 'text',
    'message_content' => 'Bonjour depuis PHP!'
];

$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $apiToken,
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
print_r($result);
?>
```

### Python

```python
import requests

api_token = 'nxt_your_api_token'
api_url = 'https://api.numericexport.com/api/v1/messages/send'

headers = {
    'Authorization': f'Bearer {api_token}',
    'Content-Type': 'application/json'
}

data = {
    'recipient_phone': '+237600000000',
    'message_type': 'text',
    'message_content': 'Bonjour depuis Python!'
}

response = requests.post(api_url, json=data, headers=headers)
result = response.json()
print(result)
```

### Node.js

```javascript
const axios = require('axios');

const apiToken = 'nxt_your_api_token';
const apiUrl = 'https://api.numericexport.com/api/v1/messages/send';

const data = {
  recipient_phone: '+237600000000',
  message_type: 'text',
  message_content: 'Bonjour depuis Node.js!'
};

axios.post(apiUrl, data, {
  headers: {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log(response.data);
})
.catch(error => {
  console.error(error.response.data);
});
```

### Java

```java
import java.net.http.*;
import java.net.URI;

public class WhatsAppAPI {
    public static void main(String[] args) throws Exception {
        String apiToken = "nxt_your_api_token";
        String apiUrl = "https://api.numericexport.com/api/v1/messages/send";
        
        String json = """
        {
            "recipient_phone": "+237600000000",
            "message_type": "text",
            "message_content": "Bonjour depuis Java!"
        }
        """;
        
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(apiUrl))
            .header("Authorization", "Bearer " + apiToken)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();
        
        HttpResponse<String> response = client.send(request, 
            HttpResponse.BodyHandlers.ofString());
        
        System.out.println(response.body());
    }
}
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

func main() {
    apiToken := "nxt_your_api_token"
    apiUrl := "https://api.numericexport.com/api/v1/messages/send"
    
    data := map[string]interface{}{
        "recipient_phone": "+237600000000",
        "message_type":    "text",
        "message_content": "Bonjour depuis Go!",
    }
    
    jsonData, _ := json.Marshal(data)
    
    req, _ := http.NewRequest("POST", apiUrl, bytes.NewBuffer(jsonData))
    req.Header.Set("Authorization", "Bearer "+apiToken)
    req.Header.Set("Content-Type", "application/json")
    
    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()
    
    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    fmt.Println(result)
}
```

### .NET (C#)

```csharp
using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

class Program
{
    static async Task Main()
    {
        string apiToken = "nxt_your_api_token";
        string apiUrl = "https://api.numericexport.com/api/v1/messages/send";
        
        var data = new
        {
            recipient_phone = "+237600000000",
            message_type = "text",
            message_content = "Bonjour depuis C#!"
        };
        
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiToken}");
        
        var json = JsonConvert.SerializeObject(data);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        
        var response = await client.PostAsync(apiUrl, content);
        var result = await response.Content.ReadAsStringAsync();
        
        Console.WriteLine(result);
    }
}
```

### PowerShell

```powershell
$apiToken = "nxt_your_api_token"
$apiUrl = "https://api.numericexport.com/api/v1/messages/send"

$headers = @{
    "Authorization" = "Bearer $apiToken"
    "Content-Type" = "application/json"
}

$body = @{
    recipient_phone = "+237600000000"
    message_type = "text"
    message_content = "Bonjour depuis PowerShell!"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $body
$response | ConvertTo-Json
```

## 📈 Vérifier le Statut d'un Message

```bash
curl -X GET https://api.numericexport.com/api/v1/messages/{message_id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📊 Statistiques

```bash
curl -X GET "https://api.numericexport.com/api/v1/messages/stats/summary?period=7days" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📥 Exporter les Messages (CSV)

```bash
curl -X GET "https://api.numericexport.com/api/v1/messages/export/csv" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o messages.csv
```

## ⚠️ Codes d'Erreur

| Code | Description |
|------|-------------|
| 200 | Succès |
| 201 | Créé avec succès |
| 400 | Requête invalide |
| 401 | Non autorisé (Token invalide) |
| 403 | Quota insuffisant |
| 404 | Ressource non trouvée |
| 429 | Trop de requêtes |
| 500 | Erreur serveur |

## 📞 Support

**Email:** team@numericexport.com  
**Site web:** https://numericexport.com  
**Dashboard:** https://dashboard.numericexport.com

---

© 2026 NEXT LTD - Tous droits réservés
