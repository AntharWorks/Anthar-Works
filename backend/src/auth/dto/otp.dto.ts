import { IsString, Length, Matches } from 'class-validator';

export class RequestOtpDto {
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid Indian mobile number' })
  phone: string;
}

export class VerifyOtpDto {
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid Indian mobile number' })
  phone: string;

  @IsString()
  @Length(6, 6)
  code: string;
}
