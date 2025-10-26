import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
    transform(value: string, metadata: ArgumentMetadata): number {
        const val = parseInt(value, 10);

        if (isNaN(val)) {
            throw new BadRequestException(`Validation failed. "${value}" is not a valid number.`);
        }

        if (val < 0) {
            throw new BadRequestException(`Validation failed. "${value}" must be a positive number.`);
        }

        return val;
    }
}
