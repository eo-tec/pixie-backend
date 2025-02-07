import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class GetPhotoDto {
	@IsInt()
	@Min(0)
	@IsNotEmpty()
	id: number;
}
