export const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export function getOtpMailHtml(otp: string) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Verification</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        .container {
            background-color: #fff;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        .otp {
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Your OTP Code</h2>
        <p class="otp">${otp}</p>
        <p>Please use this code to verify your email address.</p>
    </div>
</body>
</html>`;
}

export function getResetPasswordMailHtml(resetLink: string) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        .container {
            background-color: #fff;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
        }
        .btn {
            display: inline-block;
            margin-top: 15px;
            padding: 10px 20px;
            background-color: #333;
            color: #fff !important;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
        }
        .link {
            word-break: break-all;
            font-size: 12px;
            color: #555;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Reset Your Password</h2>
        <p>Click the button below to reset your password.</p>
        
        <a href="${resetLink}" class="btn">Reset Password</a>

        <p class="link">${resetLink}</p>

        <p style="margin-top: 15px;">
            This link will expire in 15 minutes.
        </p>

        <p style="font-size: 12px; color: #888;">
            If you did not request this, you can safely ignore this email.
        </p>
    </div>
</body>
</html>`;
}